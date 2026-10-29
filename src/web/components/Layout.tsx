import { Outlet } from 'react-router-dom';
import SideNavigation from './SideNavigation';
import { pendingQuestions } from '../lib/ownerInbox';
import { BranchIndexingIndicator } from './BranchIndexingIndicator';
import { HealthIndicator, HealthSuccessToast } from './HealthIndicator';
import { DuplicateIdWarning } from './DuplicateIdWarning';
import type { DuplicateRepairPlan } from '../../core/duplicate-task-repair';
import { type Task, type Document, type Decision } from '../../types';

interface LayoutProps {
	projectName: string;
	showSuccessToast: boolean;
	onDismissToast: () => void;
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	isLoading: boolean;
	loadingMessage?: string | null;
	error?: Error | null;
	onRefreshData: () => Promise<void>;
	duplicateRepairPlan?: DuplicateRepairPlan | null;
}

export default function Layout({
	projectName,
	showSuccessToast,
	onDismissToast,
	tasks,
	docs,
	decisions,
	isLoading,
	loadingMessage,
	error,
	onRefreshData,
	duplicateRepairPlan = null,
}: LayoutProps) {
	return (
		<div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden transition-colors duration-200">
			<HealthIndicator />
			<SideNavigation 
				taskCount={tasks.length}
				inboxCount={pendingQuestions(tasks).length}
				docs={docs}
				decisions={decisions}
				isLoading={isLoading}
				error={error}
				onRetry={onRefreshData}
				onRefreshData={onRefreshData}
			/>
			<div className="flex-1 flex flex-col min-h-0 min-w-0">
				<DuplicateIdWarning plan={duplicateRepairPlan} onRepaired={onRefreshData} />
				<main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
					<Outlet context={{ tasks, docs, decisions, isLoading, onRefreshData }} />
				</main>
			</div>
			{/* signals: no top bar (owner 2026-10-29: redundant). Indexing shows as a small floating chip; the theme toggle
			    is in the sidebar's footer, and the project name is the browser tab's title. */}
			<div className="fixed bottom-4 right-4 z-50 pointer-events-none">
				<BranchIndexingIndicator message={loadingMessage} />
			</div>
			{showSuccessToast && (
				<HealthSuccessToast onDismiss={onDismissToast} />
			)}
		</div>
	);
}
