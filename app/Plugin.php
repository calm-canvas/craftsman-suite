<?php
/**
 * Main Plugin Class
 *
 * @package CraftsmanSuite
 */

namespace CraftsmanSuite;

use CraftsmanSuite\Admin\DevTools;
use CraftsmanSuite\Api\RegenerateThumbnailsController;
use CraftsmanSuite\Api\AutoAttachThumbnailController;

/**
 * Class Plugin
 */
class Plugin {
	/**
	 * Instance of the class
	 *
	 * @var Plugin
	 */
	private static $instance = null;

	/**
	 * Admin DevTools (keeps instance for submenu callback lifetime).
	 *
	 * @var DevTools|null
	 */
	private $dev_tools;

	/**
	 * Get the singleton instance
	 *
	 * @return Plugin
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor
	 */
	public function __construct() {
		$this->load_dependencies();
		$this->init_hooks();
	}

	/**
	 * Load dependencies
	 */
	private function load_dependencies() {
		require_once \ABSPATH . 'wp-admin/includes/image.php'; // NOSONAR.
	}

	/**
	 * Initialize hooks
	 */
	private function init_hooks() {
		\add_action( 'admin_menu', array( $this, 'load_admin' ) );
		\add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		\add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Load admin pages
	 */
	public function load_admin() {
		$this->dev_tools = new DevTools();
	}

	/**
	 * Register REST API routes
	 */
	public function register_rest_routes() {
		$regen_controller = new RegenerateThumbnailsController();
		$regen_controller->register_routes();

		$auto_attach_controller = new AutoAttachThumbnailController();
		$auto_attach_controller->register_routes();
	}

	/**
	 * Enqueue scripts and styles
	 *
	 * @param string $hook The current admin page.
	 */
	public function enqueue_scripts( $hook ) {
		if ( 'tools_page_craftsman-suite' !== $hook ) {
			return;
		}

		$plugin_url = \plugin_dir_url( CRAFTSMAN_SUITE_PLUGIN_FILE );

		// Use @wordpress/scripts build artifacts.
		$asset_file = require \plugin_dir_path( CRAFTSMAN_SUITE_PLUGIN_FILE ) . 'build/index.asset.php'; // NOSONAR.

		\wp_enqueue_style(
			'craftsman-suite-dev-tools',
			$plugin_url . 'build/index.css',
			array(),
			$asset_file['version']
		);

		\wp_enqueue_script(
			'craftsman-suite-dev-tools',
			$plugin_url . 'build/index.js',
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);

		\wp_localize_script(
			'craftsman-suite-dev-tools',
			'craftsmanSuiteData',
			array(
				'nonce'      => \wp_create_nonce( 'wp_rest' ),
				'rest_url'   => \rest_url(),
				'admin_url'  => \admin_url(),
				'batch_size' => (int) \apply_filters( 'craftsman_suite_thumbnail_batch_size', 1 ),
			)
		);
	}
}
