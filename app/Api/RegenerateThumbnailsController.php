<?php
/**
 * Regenerate Thumbnails Controller
 *
 * @package CraftsmanSuite\Api
 */

namespace CraftsmanSuite\Api;

use CraftsmanSuite\Services\BatchProcessor;

/**
 * Class RegenerateThumbnailsController
 */
class RegenerateThumbnailsController {

	private const REST_NAMESPACE = 'craftsman-suite/v1';

	/**
	 * Register REST API routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		\register_rest_route(
			self::REST_NAMESPACE,
			'/regenerate-thumbnails/attachments',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_all_attachments' ),
				'permission_callback' => array( $this, 'check_permission' ),
			)
		);

		\register_rest_route(
			self::REST_NAMESPACE,
			'/regenerate-thumbnails/batch',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'process_batch' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'attachment_id' => array(
						'type'     => 'integer',
						'required' => true,
					),
				),
			)
		);

		\register_rest_route(
			self::REST_NAMESPACE,
			'/regenerate-thumbnails/batch-process',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'process_batch_multiple' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'attachment_ids' => array(
						'type'     => 'array',
						'items'    => array( 'type' => 'integer' ),
						'required' => true,
					),
				),
			)
		);

		\register_rest_route(
			self::REST_NAMESPACE,
			'/regenerate-thumbnails/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_status' ),
				'permission_callback' => array( $this, 'check_permission' ),
			)
		);

		\register_rest_route(
			self::REST_NAMESPACE,
			'/regenerate-thumbnails/sizes',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_registered_sizes' ),
				'permission_callback' => array( $this, 'check_permission' ),
			)
		);
	}

	/**
	 * Check if user has permission to access the endpoints.
	 *
	 * @return bool
	 */
	public function check_permission() {
		return \current_user_can( 'manage_options' );
	}

	/**
	 * Get all attachment IDs.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_all_attachments() {
		$attachments = \get_posts(
			array(
				'post_type'      => 'attachment',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'orderby'        => 'ID',
				'order'          => 'ASC',
			)
		);

		return new \WP_REST_Response(
			array(
				'success'        => true,
				'total'          => count( $attachments ),
				'attachment_ids' => $attachments,
			)
		);
	}

	/**
	 * Process a single attachment.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function process_batch( \WP_REST_Request $request ) {
		$attachment_id = intval( $request->get_param( 'attachment_id' ) );

		if ( $attachment_id <= 0 ) {
			return new \WP_REST_Response(
				array(
					'success' => false,
					'message' => 'Invalid or missing attachment ID',
				),
				400
			);
		}

		$result = BatchProcessor::regenerate_single_attachment( $attachment_id );

		return new \WP_REST_Response(
			array(
				'success' => true,
				'result'  => $result,
			)
		);
	}

	/**
	 * Process multiple attachments.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function process_batch_multiple( \WP_REST_Request $request ) {
		$attachment_ids = $request->get_param( 'attachment_ids' );
		$selected_sizes = $request->get_param( 'selected_sizes' );
		$skip_existing  = $request->get_param( 'skip_existing' );

		if ( ! is_array( $attachment_ids ) || empty( $attachment_ids ) ) {
			return new \WP_REST_Response(
				array(
					'success' => false,
					'message' => 'Invalid or missing attachment IDs',
				),
				400
			);
		}

		$attachment_ids = array_filter( array_map( 'intval', $attachment_ids ) );
		$selected_sizes = is_array( $selected_sizes ) ? array_filter( array_map( 'sanitize_text_field', $selected_sizes ) ) : array();
		$skip_existing  = (bool) $skip_existing;

		$results = BatchProcessor::process_batch( $attachment_ids, $selected_sizes, $skip_existing );

		return new \WP_REST_Response(
			array(
				'success' => true,
				'results' => $results,
			)
		);
	}

	/**
	 * Get registered image sizes.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_registered_sizes() {
		$sizes            = \get_intermediate_image_sizes();
		$additional_sizes = \wp_get_additional_image_sizes();
		$result           = array();

		foreach ( $sizes as $size ) {
			if ( isset( $additional_sizes[ $size ] ) ) {
				$width  = $additional_sizes[ $size ]['width'];
				$height = $additional_sizes[ $size ]['height'];
			} else {
				$width  = \get_option( "{$size}_size_w" );
				$height = \get_option( "{$size}_size_h" );
			}

			if ( 0 === (int) $width && 0 === (int) $height ) {
				continue;
			}

			$label           = ucfirst( str_replace( array( '-', '_' ), ' ', $size ) );
			$result[ $size ] = sprintf( '%s (%dx%d)', $label, $width, $height );
		}

		return new \WP_REST_Response(
			array(
				'success' => true,
				'sizes'   => $result,
			)
		);
	}

	/**
	 * Get regeneration status.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_status() {
		$transient = \get_transient( 'craftsman-suite_regen_status' );

		return new \WP_REST_Response(
			array(
				'success' => true,
				'status'  => ! empty( $transient ) ? $transient : array(),
			)
		);
	}
}
