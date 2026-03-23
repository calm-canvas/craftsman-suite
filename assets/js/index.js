import { createRoot, useEffect } from '@wordpress/element';
import AutoAttachThumbnail from './components/AutoAttachThumbnail';
import RegenerateThumbnails from './components/RegenerateThumbnails';
import { __ } from '@wordpress/i18n';

const App = () => {
	useEffect(() => {
		const initDarkMode = () => {
			const mediaQuery = globalThis.matchMedia?.(
				'(prefers-color-scheme: dark)'
			);
			if (mediaQuery?.matches) {
				document.documentElement.classList.add('dark');
			}
			mediaQuery?.addEventListener('change', (event) => {
				if (event.matches) {
					document.documentElement.classList.add('dark');
				} else {
					document.documentElement.classList.remove('dark');
				}
			});
		};
		initDarkMode();
	}, []);

	return (
		<div className="px-4 sm:px-8 lg:px-12 py-8 max-w-6xl mx-auto">
			<header className="mb-8">
				<h1 className="text-3xl font-normal text-wp-text mb-2">
					{__('Craftsman Suite', 'craftsman-suite')}
				</h1>
				<p className="text-sm text-wp-sub leading-relaxed max-w-3xl">
					{__(
						'Utility tools for WordPress developers to automate common tasks and streamline workflow.',
						'craftsman-suite'
					)}
				</p>
			</header>

			<div className="bg-wp-surface dark:bg-[#2c3338] border-l-4 border-wp-primary shadow-wp-card p-4 mb-8 flex items-start rounded-r-sm">
				<span className="dashicons dashicons-info text-wp-primary mr-3 mt-0.5 flex-shrink-0"></span>
				<div>
					<p className="text-sm text-wp-text leading-relaxed">
						{__(
							'Make sure to backup your database before running bulk operations.',
							'craftsman-suite'
						)}
					</p>
				</div>
			</div>

			<AutoAttachThumbnail />
			<RegenerateThumbnails />

			<footer className="mt-12 pt-6 border-t border-wp-border flex justify-between items-center text-xs text-wp-sub">
				<p>
					{__(
						'Powered by passion and lots of coffee.',
						'craftsman-suite'
					)}
					&nbsp;
					<a
						className="text-wp-primary hover:underline"
						href="https://github.com/calm-canvas/craftsman-suite"
					>
						Documentation
					</a>
					{'.'}
				</p>
			</footer>
		</div>
	);
};

document.addEventListener('DOMContentLoaded', () => {
	const root = document.getElementById('craftsman-suite-dev-tools-root');
	if (root) {
		createRoot(root).render(<App />);
	}
});
