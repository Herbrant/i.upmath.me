/**
 * Markdown parser
 *
 * Originally written by Colin Kuebler 2012
 * Modified by Roman Parpalak 2015
 */

function MarkdownParser(i) {
	/* INIT */
	var api = this;

	// variables used internally
	i = i ? 'i' : '';
	var parseInlineRE = null,
		parseBlockRE = null,
		ruleMap = {},
		ruleBlockMap = {},
		ruleInlineMap = {},
		runInBlocks = {},
		markers = {};

	var subRules,
		subRulesMap = {},
		subRulesRE = {};

	function addBlockRule(s, rule) {
		var re = new RegExp('^(' + s + ')$', i);
		ruleMap[rule] = re;
		ruleBlockMap[rule] = re;
	}

	function addInlineRule(s, rule) {
		var re = new RegExp('^(' + s + ')$', i);
		ruleMap[rule] = re;
		ruleInlineMap[rule] = re;
	}

	function addSubruleMap(s, rule, block) {
		if (!subRulesMap[block]) {
			subRulesMap[block] = {};
		}
		subRulesMap[block][rule] = new RegExp('^(' + s + ')$', i);
	}

	api.addInlineRules = function (rules) {
		var ruleSrc = [];

		for (var rule in rules) {
			if (rules.hasOwnProperty(rule)) {
				var s = rules[rule].source;
				ruleSrc.push(s);
				addInlineRule(s, rule);
			}
		}

		parseInlineRE = new RegExp('(' + ruleSrc.join('|') + ')', i);

		return this;
	};
	api.addSubRules = function (rules) {
		subRules = rules;

		for (var block in rules) {
			if (rules.hasOwnProperty(block)) {
				var rules2 = rules[block],
					p = [];
				for (var rule in rules2) {
					if (rules2.hasOwnProperty(rule)) {
						var s = rules2[rule].source;
						addSubruleMap(s, rule, block);
						p.push(s);
					}
				}

				subRulesRE[block] = new RegExp('(' + p.join('|') + ')', i);
			}
		}

		return this;
	};
	api.addBlockRules = function (rules) {
		var ruleArray = [];

		for (var rule in rules) {
			if (rules.hasOwnProperty(rule)) {
				var s = rules[rule].source;
				ruleArray.push(s);
				addBlockRule(s, rule);
			}
		}
		parseBlockRE = new RegExp('(' + ruleArray.join('|') + ')', i);

		return this;
	};
	api.addRunIn = function (rules) {
		runInBlocks = rules;

		return this;
	};
	api.addMarkers = function (m) {
		markers = m;

		return this;
	};

	function tokenizeBlock(block, className, result) {
		var re = parseInlineRE;

		// Process specific rules for the given block type className
		if (className in subRules ) {
			if (subRules[className] === null) {
				result.push({
					token: block,
					block: className
				});

				return;
			}
			else {
				re = subRulesRE[className];
			}
		}

		// Token for a block marker
		if (typeof markers[className] !== 'undefined') {
			var matches = block.match(markers[className]);
			if (matches[2]) {
				result.push({
					token: matches[1],
					block: className + '-mark'
				});
				block = matches[2];
			}
		}

		var items = block.split(re),
			j = 0, token;

		for (; j < items.length; j++) {
			token = items[j];
			if (token != '') {
				result.push({
					token: token,
					block: className
				});
			}
		}
	}

	api.tokenize = function (input) {
		input = input.replace('\r', '');

		var result = [],
			classNames = [],
			blocks = input.split(parseBlockRE),
			blockNum = blocks.length,
			block, i,
			prevIndex = 0, prevBlockClass;

		// Merge blocks separated by line breaks
		for (i = 0; i < blockNum; i++) {
			if (blocks[i] === '') {
				continue;
			}

			var className = identify(blocks[i], ruleBlockMap);

			if (prevIndex > 0 && className in runInBlocks) {
				var allowedPrevBlocks = runInBlocks[className].allowedBlocks;
				if (allowedPrevBlocks.indexOf(prevBlockClass) >= 0) {
					blocks[prevIndex] += blocks[i];
					blocks[i] = '';
					classNames[i] = '';

					continue;
				}
			}

			classNames[i] = className;

			prevIndex = i;
			prevBlockClass = className;
		}

		for (i = 0; i < blockNum; i++) {
			block = blocks[i];
			if (block !== '') {
				tokenizeBlock(block, classNames[i], result);
			}
		}

		return result;
	};
	api.identifyInline = function (tokenObj) {
		var className = tokenObj.block,
			map = ruleInlineMap;

		if (className in subRules) {
			if (subRules[className] === null) {
				return '';
			}
			else {
				map = subRulesMap[className];
			}
		}
		return identify(tokenObj.token, map);
	};

	function identify(token, ruleMap) {
		for (var rule in ruleMap) {
			if (ruleMap.hasOwnProperty(rule) && ruleMap[rule].test(token)) {
				return rule;
			}
		}

		return '';
	}

	return api;
}

// Markdown syntax parser
var mdParser = new MarkdownParser();

mdParser
	.addBlockRules({
		latexBlock:/\$\$\n?[^\n]+(?:\n[^\n]+)*\n?\$\$(?:[ \t]*\([ \t]*\S+[ \t]*\))?(?:\n|$)/,
		empty:     /(?:[ \t]*\n)+/,
		fence:     /```[\s\S]*?(?:$|```(?:\n|$))/,
		reference: /\[[^\]]+\]\:[^\n]*(?:\n|$)/,
		header:    /#{1,6} [^\n]*(?:\n|$)/,
		header2:   /[^\n]+\n[ \t]*[=-]{2,}(?:\n|$)/,
		rule:      /(?:[\*]{3,}|[\-]{3,}|[\_]{3,})(?:\n|$)/,
		list:      /[ ]{0,3}(?:[+\-\*]|\d+\.)[ \t]+[^\n]*(?:\n[ \t]*[^\n\t ]+[ \t]*)*(?:\n|$)/,
		quote:     /[ ]{0,3}>[^\n]*(?:\n|$)/,
		paragraph: /[\s\S]*?(?:\n|$)/
	})
	.addInlineRules({
		latex:      /\$\$[\s\S]*?\$\$/,
		link:       /\[.+?\][\(\[].*?[\)\]]/,
		bold:       /(?:\s|^)__[\s\S]*?\S__|\*\*[\s\S]*?\S\*\*/,
		italic:     /(?:\s|^)_[\s\S]*?[^\\\s]_|\*[^\\\s]\*|\*\S[\s\S]*?[^\\\s]\*/,
		strike:     /~~.+?~~/,
		sup:        /\^.+?\^/,
		sub:        /~.+?~/,
		code:       /``.+?``|`.*?[^`\\]`(?!`)/
	})
	.addSubRules({
		fence: null,
		rule:  null,
		latexBlock: {
			comment:   /%[^\n]*?(?=\$\$)|%[^\n]*/,
			keyword:   /\\[a-zA-Z�-��-�]+[\*]?/,
			keyword2:  /\\[^a-zA-Z�-��-�0-9]/,
			keyword3:  /&/,
			delimeter: /\$\$/
		}
	})
	.addRunIn({
		paragraph: {
			allowedBlocks : ['paragraph', 'quote', 'list']
		}
	})
	.addMarkers({
		list:  /^([ ]{0,3}(?:[+\-\*]|\d+\.)[ \t]+)([\s\S]*)$/,
		quote: /^([ ]{0,3}(?:>[ \t]*)+)([\s\S]*)$/
	});
