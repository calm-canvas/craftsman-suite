import { useState, useEffect, useRef } from '@wordpress/element';
import {
	Button,
	PanelBody,
	CheckboxControl,
	RangeControl,
	Notice,
	Spinner,
	ProgressBar,
	Card,
	CardHeader,
	CardBody,
	CardFooter,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

const REST_API_BASE = '/craftsman-suite/v1';

const RegenerateThumbnails = () => {
	const [view, setView] = useState('settings');
	const [status, setStatus] = useState('idle');
	const [settings, setSettings] = useState({
		batchSize: Number(globalThis.craftsmanSuiteData?.batch_size || 1),
		selectedSizes: [],
		skipExisting: false,
	});
	const [availableSizes, setAvailableSizes] = useState({});
	const [isLoadingSizes, setIsLoadingSizes] = useState(true);
	const [notice, setNotice] = useState(null);

	useEffect(() => {
		if (notice) {
			const timer = setTimeout(() => {
				setNotice(null);
			}, 5000);
			return () => clearTimeout(timer);
		}
	}, [notice]);

	const [stats, setStats] = useState({
		total: 0,
		processed: 0,
		completed: 0,
		failed: 0,
		pending: 0,
		percentage: 0,
		startTime: null,
		duration: 0,
	});

	const [lastProcessed, setLastProcessed] = useState('');
	const isMountedRef = useRef(true);
	const shouldStopRef = useRef(false);

	useEffect(() => {
		fetchSizes();
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const fetchSizes = async () => {
		try {
			const response = await apiFetch({
				path: `${REST_API_BASE}/regenerate-thumbnails/sizes`,
			});
			if (isMountedRef.current && response.success) {
				setAvailableSizes(response.sizes);
				setSettings((prev) => ({
					...prev,
					selectedSizes: Object.keys(response.sizes),
				}));
			}
		} catch (error) {
			console.error('Failed to fetch sizes', error);
		} finally {
			setIsLoadingSizes(false);
		}
	};

	const handleStart = async () => {
		shouldStopRef.current = false;
		setStatus('loading');
		setView('progress');
		setNotice(null);

		try {
			const response = await apiFetch({
				path: `${REST_API_BASE}/regenerate-thumbnails/attachments`,
			});
			if (!isMountedRef.current) {
				return;
			}

			if (response.success) {
				const ids = response.attachment_ids;
				const initialStats = {
					total: response.total,
					processed: 0,
					completed: 0,
					failed: 0,
					pending: response.total,
					percentage: 0,
					startTime: Date.now(),
					duration: 0,
				};
				setStats(initialStats);
				setStatus('processing');
				processBatches(
					ids,
					0,
					{ completed: 0, failed: 0 },
					initialStats.startTime
				);
			}
		} catch (error) {
			console.error('Failed to start process', error);
			setStatus('error');
			setNotice({
				type: 'error',
				message: __('Failed to start the process.', 'craftsman-suite'),
			});
		}
	};

	const processBatches = async (
		allIds,
		currentIndex,
		currentStats,
		startTime
	) => {
		if (!isMountedRef.current || shouldStopRef.current) {
			if (shouldStopRef.current) {
				setStatus('stopped');
			}
			return;
		}

		if (currentIndex >= allIds.length) {
			const endTime = Date.now();
			const duration = Math.round((endTime - startTime) / 1000);
			const finalStats = {
				...stats,
				duration,
				pending: 0,
				percentage: 100,
			};
			setStats(finalStats);
			setStatus('completed');
			setNotice({
				type: 'success',
				message: sprintf(
					__(
						'Successfully regenerated thumbnails for %d images in %d seconds.',
						'craftsman-suite'
					),
					currentStats.completed,
					duration
				),
			});
			return;
		}

		const batchIds = allIds.slice(
			currentIndex,
			currentIndex + settings.batchSize
		);

		try {
			const response = await apiFetch({
				path: `${REST_API_BASE}/regenerate-thumbnails/batch-process`,
				method: 'POST',
				data: {
					attachment_ids: batchIds,
					selected_sizes: settings.selectedSizes,
					skip_existing: settings.skipExisting,
				},
			});

			if (!isMountedRef.current || shouldStopRef.current) {
				if (shouldStopRef.current) {
					setStatus('stopped');
				}
				return;
			}

			const results = response.results || {};
			let newCompleted = currentStats.completed;
			let newFailed = currentStats.failed;
			let lastFile = '';

			Object.values(results).forEach((res) => {
				if (res.success) {
					newCompleted++;
					lastFile = res.filename;
				} else {
					newFailed++;
				}
			});

			const processed = currentIndex + batchIds.length;
			const percentage = Math.round((processed / allIds.length) * 100);

			setStats((prev) => ({
				...prev,
				processed,
				completed: newCompleted,
				failed: newFailed,
				pending: allIds.length - processed,
				percentage,
			}));

			if (lastFile) {
				setLastProcessed(lastFile);
			}

			// Small delay to allow UI updates
			await new Promise((resolve) => setTimeout(resolve, 50));

			processBatches(
				allIds,
				processed,
				{ completed: newCompleted, failed: newFailed },
				startTime
			);
		} catch (error) {
			console.error('Batch failed', error);
			setStatus('error');
			setNotice({
				type: 'error',
				message: __('Batch processing failed.', 'craftsman-suite'),
			});
		}
	};

	const handleStop = () => {
		shouldStopRef.current = true;
	};

	const toggleSizeSelection = (size, checked) => {
		setSettings((prev) => ({
			...prev,
			selectedSizes: checked
				? [...prev.selectedSizes, size]
				: prev.selectedSizes.filter((s) => s !== size),
		}));
	};

	const handleStartOver = () => {
		setView('settings');
		setStatus('idle');
		setStats({
			total: 0,
			processed: 0,
			completed: 0,
			failed: 0,
			pending: 0,
			percentage: 0,
			startTime: null,
			duration: 0,
		});
		setLastProcessed('');
		setNotice(null);
	};

	const renderSettings = () => (
		<PanelBody className="bg-white border border-wp-border shadow-wp-card rounded-sm overflow-hidden p-0">
			<div className="divide-y divide-gray-100">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 items-start">
					<div className="md:col-span-1">
						<label className="text-sm font-semibold text-wp-heading">
							{__('Images per Batch', 'craftsman-suite')}
						</label>
						<p className="text-xs text-gray-500 mt-1 leading-relaxed">
							{__(
								'The number of images processed in a single AJAX request.',
								'craftsman-suite'
							)}
						</p>
					</div>
					<div className="md:col-span-2">
						<RangeControl
							value={settings.batchSize}
							onChange={(value) =>
								setSettings({ ...settings, batchSize: value })
							}
							min={1}
							max={50}
							help={__(
								'Low (1–10) for shared hosting, High (20+) for dedicated servers.',
								'craftsman-suite'
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 items-start">
					<div className="md:col-span-1">
						<label className="text-sm font-semibold text-wp-heading">
							{__('Target Thumbnail Sizes', 'craftsman-suite')}
						</label>
						<p className="text-xs text-gray-500 mt-1 leading-relaxed">
							{__(
								'Select specific sizes to regenerate to save time and resources.',
								'craftsman-suite'
							)}
						</p>
					</div>
					<div className="md:col-span-2 space-y-3">
						{isLoadingSizes ? (
							<Spinner />
						) : (
							Object.entries(availableSizes).map(
								([size, label]) => (
									<CheckboxControl
										key={size}
										label={label}
										checked={settings.selectedSizes.includes(
											size
										)}
										onChange={(checked) =>
											toggleSizeSelection(size, checked)
										}
									/>
								)
							)
						)}
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 items-start">
					<div className="md:col-span-1">
						<label className="text-sm font-semibold text-wp-heading">
							{__('Advanced Options', 'craftsman-suite')}
						</label>
					</div>
					<div className="md:col-span-2">
						<CheckboxControl
							label={__(
								'Skip existing correctly sized thumbnails',
								'craftsman-suite'
							)}
							help={__(
								'Only regenerate if the file is missing or dimensions are incorrect.',
								'craftsman-suite'
							)}
							checked={settings.skipExisting}
							onChange={(checked) =>
								setSettings({
									...settings,
									skipExisting: checked,
								})
							}
						/>
					</div>
				</div>
			</div>
			<div className="bg-gray-50 border-t border-wp-border px-6 py-4 flex items-center justify-end">
				<Button
					variant="primary"
					onClick={handleStart}
					disabled={settings.selectedSizes.length === 0}
				>
					{__('Start Regenerating Thumbnails', 'craftsman-suite')}
				</Button>
			</div>
		</PanelBody>
	);

	const renderProgress = () => {
		const isCompleted = status === 'completed';
		const isStopped = status === 'stopped';
		const isRunning = status === 'processing';
		let statusBadgeClass = 'bg-gray-100 text-gray-800';
		if (isCompleted) {
			statusBadgeClass = 'bg-green-100 text-green-800';
		} else if (isRunning) {
			statusBadgeClass = 'bg-blue-100 text-blue-800';
		}

		return (
			<Card className="bg-wp-surface border border-wp-border shadow-wp-card sm:rounded-sm">
				<CardHeader className="px-4 py-4 sm:px-6 border-b border-wp-border flex justify-between items-center bg-white">
					<h3 className="text-sm font-semibold text-gray-900">
						{__('Progress', 'craftsman-suite')}
					</h3>
					<span
						className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass}`}
					>
						{status.charAt(0).toUpperCase() + status.slice(1)}
					</span>
				</CardHeader>
				<CardBody className="p-4 sm:p-6 space-y-6">
					<div className="space-y-2">
						<div className="flex justify-between text-sm text-wp-sub mb-1">
							<span>
								{__('Processing image', 'craftsman-suite')}{' '}
								<strong>{stats.processed}</strong>{' '}
								{__('of', 'craftsman-suite')}{' '}
								<strong>{stats.total}</strong>
							</span>
							<span className="font-medium text-gray-800">
								{stats.percentage}%
							</span>
						</div>
						<ProgressBar
							value={stats.percentage}
							className="w-full"
						/>
						<p className="text-xs text-wp-sub italic mt-1">
							{__('Last processed:', 'craftsman-suite')}{' '}
							<span className="text-gray-600">
								{lastProcessed ||
									__('Waiting…', 'craftsman-suite')}
							</span>
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
						<div className="flex flex-col border-l-4 border-green-500 bg-white pl-4 py-1">
							<span className="text-xs font-medium text-wp-sub uppercase tracking-wide">
								{__('Completed', 'craftsman-suite')}
							</span>
							<div className="flex items-baseline mt-1">
								<span className="text-2xl font-semibold text-gray-900">
									{stats.completed}
								</span>
								<span className="ml-2 text-sm text-gray-500">
									{__('items', 'craftsman-suite')}
								</span>
							</div>
						</div>
						<div className="flex flex-col border-l-4 border-red-500 bg-white pl-4 py-1">
							<span className="text-xs font-medium text-wp-sub uppercase tracking-wide">
								{__('Failed', 'craftsman-suite')}
							</span>
							<div className="flex items-baseline mt-1">
								<span className="text-2xl font-semibold text-gray-900">
									{stats.failed}
								</span>
								<span className="ml-2 text-sm text-gray-500">
									{__('items', 'craftsman-suite')}
								</span>
							</div>
						</div>
						<div className="flex flex-col border-l-4 border-orange-500 bg-white pl-4 py-1">
							<span className="text-xs font-medium text-wp-sub uppercase tracking-wide">
								{__('Pending', 'craftsman-suite')}
							</span>
							<div className="flex items-baseline mt-1">
								<span className="text-2xl font-semibold text-gray-900">
									{stats.pending}
								</span>
								<span className="ml-2 text-sm text-gray-500">
									{__('items', 'craftsman-suite')}
								</span>
							</div>
						</div>
					</div>
				</CardBody>
				<CardFooter className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
					{isCompleted && (
						<Button
							variant="primary"
							onClick={() =>
								(globalThis.location.href =
									globalThis.craftsmanSuiteData.admin_url +
									'upload.php')
							}
						>
							{__('Return to Media Library', 'craftsman-suite')}
						</Button>
					)}
					{(isCompleted || isStopped) && (
						<Button variant="secondary" onClick={handleStartOver}>
							{__('Start Over', 'craftsman-suite')}
						</Button>
					)}
					<div className="flex-grow"></div>
					{isRunning && (
						<Button
							variant="link"
							isDestructive
							onClick={handleStop}
						>
							{__('Stop Process', 'craftsman-suite')}
						</Button>
					)}
				</CardFooter>
			</Card>
		);
	};

	return (
		<div className="craftsman-suite-module mt-8">
			<div className="mb-6">
				<h2 className="text-2xl font-medium text-gray-800 mb-2">
					{__('Regenerate Thumbnails', 'craftsman-suite')}
				</h2>
				<p className="text-[13px] text-wp-sub leading-relaxed max-w-4xl">
					{__(
						'This tool regenerates thumbnails for all image attachments. This is useful if you have changed your theme or one of your thumbnail dimensions.',
						'craftsman-suite'
					)}
				</p>
			</div>

			{notice && (
				<Notice
					status={notice.type}
					onRemove={() => setNotice(null)}
					className="mb-4"
				>
					{notice.message}
				</Notice>
			)}

			{view === 'settings' ? renderSettings() : renderProgress()}
		</div>
	);
};

export default RegenerateThumbnails;
