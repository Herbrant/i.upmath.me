<?php
/**
 * Makes latex documents containing a formula.
 *
 * @copyright 2015-2016 Roman Parpalak
 * @license   http://www.opensource.org/licenses/mit-license.php MIT
 * @package   S2 Latex Service
 * @link      http://tex.s2cms.ru
 */

namespace S2\Tex;

use S2\Tex\Tpl\Formula;

/**
 * Class Templater
 */
class Templater implements TemplaterInterface
{
	private $dir;

	public function __construct($dir)
	{
		$this->dir = $dir;
	}

	/**
	 * {@inheritdoc}
	 */
	public function run($formula)
	{
		$isMathMode    = true;
		$extraPackages = [];

		// Check if there are used certain environments and include corresponding packages
		$test_env = [
			'eqnarray'        => 'eqnarray',
			'tikzcd'          => 'tikz-cd',
			'tikzpicture'     => 'tikz',
			'circuitikz'      => 'circuitikz',
			'sequencediagram' => 'pgf-umlsd',
			'prooftree'       => 'bussproofs',
			'align'           => '', // just turns math mode off
		];

		foreach ($test_env as $command => $env) {
			if (strpos($formula, '\\begin{' . $command . '}') !== false || strpos($formula, '\\begin{' . $command . '*}') !== false) {
				$isMathMode = false;
				if ($env) {
					$extraPackages[] = new Tpl\Package($env);
				}
			}
		}

		// Check if there are used certain commands and include corresponding packages
		$test_command = [
			'\\addplot'             => 'pgfplots',
			'\\smartdiagram'        => 'smartdiagram',
			'\\DisplayProof'        => 'bussproofs',
			'\\tdplotsetmaincoords' => 'tikz-3dplot',
		];

		foreach ($test_command as $command => $env) {
			if (strpos($formula, $command) !== false) {
				$isMathMode = false; // TODO make an option
				if ($env) {
					$extraPackages[] = new Tpl\Package($env);
				}
			}
		}

		// Custom rules
		if (strpos($formula, '\\xymatrix') !== false || strpos($formula, '\\begin{xy}') !== false) {
			$extraPackages[] = new Tpl\Package('xy', ['all']);
		}

		$extraPackages[] = new Tpl\Package('inputenc', ['utf8']);
		if (preg_match('#[А-Яа-яЁё]#u', $formula)) {
			$extraPackages[] = new Tpl\Package('babel', ['russian']);
		}

		// Other setup
		if (substr($formula, 0, 7) == '\\inline') {
			$formula = '\\textstyle ' . substr($formula, 7);
		}

		$tpl = $isMathMode ? 'displayformula' : 'common';

		ob_start();
		include $this->dir . $tpl . '.php';
		$text = ob_get_clean();

		return new Formula($text, $isMathMode);
	}
}
