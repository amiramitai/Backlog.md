import React from 'react';
import { type Task } from '../../types';
import { formatPriorityLabel } from '../../utils/priority-config';
import AcceptanceCriteriaProgress, { getAcceptanceCriteriaProgressCounts } from './AcceptanceCriteriaProgress';
import StoredDate from './StoredDate';
import ProjectBadge from './ProjectBadge';
import TaskTypeBadge from './TaskTypeBadge';


// signals: stable tones for label pills and assignee avatars, picked by a hash of the text.
const TONES = [
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-200',
];
const AVATARS = ['bg-rose-700', 'bg-amber-700', 'bg-emerald-700', 'bg-sky-700', 'bg-violet-700', 'bg-fuchsia-700', 'bg-teal-700'];
const hashOf = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const labelTone = (label: string) => TONES[hashOf(label) % TONES.length];
const avatarTone = (who: string) => AVATARS[hashOf(who) % AVATARS.length];

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onEdit: (task: Task) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  status?: string;
  laneId?: string;
  availableTypes?: string[];
  availableProjects?: string[];
  dateFormat?: string;
  isSelected?: boolean;
  selectionCount?: number;
  onSelect?: (event: { shiftKey: boolean }) => void;
  isSelectionDragging?: boolean;
  onSelectionDragChange?: (active: boolean) => void;
}

// Dragging a selected card moves the whole selection, so the drag image has to show it. Stacking
// empty cards (up to two) behind a copy of the dragged one, plus the count of every task that will
// move, keeps the board's own card styling.
const buildSelectionDragImage = (source: HTMLElement, count: number): HTMLElement => {
  const width = source.offsetWidth;
  const height = source.offsetHeight;
  const layer = (offset: number) => `position:absolute;top:${offset}px;left:${offset}px;width:${width}px;height:${height}px;margin:0;`;

  const behind = Math.min(count - 1, 2);
  const spread = 6 * behind;
  const ghost = document.createElement('div');
  ghost.style.cssText = `position:fixed;top:-1000px;left:-1000px;width:${width + spread}px;height:${height + spread}px;pointer-events:none;`;

  for (let depth = behind; depth >= 1; depth -= 1) {
    const shell = document.createElement('div');
    shell.className = source.className;
    shell.style.cssText = layer(6 * depth);
    ghost.appendChild(shell);
  }

  const front = source.cloneNode(true) as HTMLElement;
  front.style.cssText = layer(0);
  ghost.appendChild(front);

  const badge = document.createElement('div');
  badge.textContent = String(count);
  badge.style.cssText =
    'position:absolute;top:-8px;right:-8px;min-width:24px;height:24px;padding:0 6px;border-radius:9999px;' +
    'background:#3b82f6;color:#ffffff;font-size:12px;font-weight:600;line-height:24px;text-align:center;' +
    'box-shadow:0 1px 3px rgba(0,0,0,0.3);';
  ghost.appendChild(badge);

  return ghost;
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDragStart,
  onDragEnd,
  status,
  laneId,
  availableTypes,
  availableProjects,
  dateFormat,
  isSelected = false,
  selectionCount = 0,
  onSelect,
  isSelectionDragging = false,
  onSelectionDragChange,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [showBranchTooltip, setShowBranchTooltip] = React.useState(false);

  // Check if task is from another branch (read-only)
  const isFromOtherBranch = Boolean(task.branch);
  const acceptanceCriteriaProgress = getAcceptanceCriteriaProgressCounts(task);
  const accessibleLabel = acceptanceCriteriaProgress
    ? `Open ${task.id}: ${task.title}. Acceptance criteria progress: ${acceptanceCriteriaProgress.checked} of ${acceptanceCriteriaProgress.total}`
    : `Open ${task.id}: ${task.title}`;

  const handleDragStart = (e: React.DragEvent) => {
    // Prevent dragging cross-branch tasks
    if (isFromOtherBranch) {
      e.preventDefault();
      setShowBranchTooltip(true);
      setTimeout(() => setShowBranchTooltip(false), 3000);
      return;
    }

    e.dataTransfer.setData('text/plain', task.id);
    if (status) {
      e.dataTransfer.setData('text/status', status);
    }
    if (laneId !== undefined) {
      e.dataTransfer.setData('text/lane', laneId);
    }
    e.dataTransfer.effectAllowed = 'move';

    // A modifier-press that turns straight into a drag never completes the click, so the selection
    // would miss the very card being dragged and both the badge and the drop would come up one
    // short. Joining the selection here keeps them in agreement with what the user grabbed.
    const joinsSelection = !isSelected && selectionCount > 0 && (e.ctrlKey || e.metaKey) && Boolean(onSelect);
    if (joinsSelection) onSelect?.({ shiftKey: false });
    const batchCount = isSelected ? selectionCount : joinsSelection ? selectionCount + 1 : 1;

    if (batchCount > 1) {
      // The whole selection moves with this drag, so every selected card on the board carries the
      // same dragging treatment as the grabbed one.
      onSelectionDragChange?.(true);
      if (typeof e.dataTransfer.setDragImage === 'function') {
        const ghost = buildSelectionDragImage(e.currentTarget as HTMLElement, batchCount);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 16, 16);
        // The browser snapshots the element during setDragImage, so it only has to survive this tick.
        setTimeout(() => ghost.remove(), 0);
      }
    }

    setIsDragging(true);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onSelectionDragChange?.(false);
    onDragEnd?.();
  };

  const getPriorityClass = (priority?: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-red-500 dark:border-l-red-400';
      case 'medium': return 'border-l-4 border-l-yellow-500 dark:border-l-yellow-400';
      case 'low': return 'border-l-4 border-l-green-500 dark:border-l-green-400';
      default: return 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'p0': return { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-300', label: 'P0' };
      case 'p1': return { bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', label: 'P1' };
      case 'p2': return { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-200', label: 'P2' };
      case 'p3': return { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-200', label: 'P3' };
      case 'high': return { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-300', label: 'High' };
      case 'medium': return { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-200', label: 'Medium' };
      case 'low': return { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-200', label: 'Low' };
      default:
        return priority
          ? {
              bg: 'bg-gray-100 dark:bg-gray-600',
              text: 'text-gray-700 dark:text-gray-200',
              label: formatPriorityLabel(priority),
            }
          : null;
    }
  };

  const priorityBadge = getPriorityBadge(task.priority);
  const excerpt = (task.description ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[#*`>_\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  return (
    <div className="relative">
      {/* Branch tooltip when trying to drag cross-branch task */}
      {showBranchTooltip && isFromOtherBranch && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md shadow-lg whitespace-nowrap">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Switch to <span className="font-semibold text-amber-300">{task.branch}</span> branch to move this task
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900 dark:bg-gray-700"></div>
        </div>
      )}

      <div
        className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-2 transition-all duration-200 ${
          isFromOtherBranch 
            ? 'opacity-75 cursor-not-allowed border-dashed' 
            : 'cursor-pointer hover:shadow-md dark:hover:shadow-none hover:border-gray-300 dark:hover:border-gray-500'
        } ${
          isDragging || (isSelected && isSelectionDragging) ? 'opacity-50 transform rotate-2 scale-105' : ''
        } ${
          isSelected
            ? 'ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
            : ''
        }`}
        aria-selected={isSelected}
        draggable={!isFromOtherBranch}
		role="button"
		tabIndex={0}
		aria-label={accessibleLabel}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(event) => {
          // Ctrl/Cmd and Shift belong to the board selection, so they must not open the editor.
          if (onSelect && !isFromOtherBranch && (event.ctrlKey || event.metaKey || event.shiftKey)) {
            event.preventDefault();
            event.stopPropagation();
            onSelect({ shiftKey: event.shiftKey });
            return;
          }
          onEdit(task);
        }}
		onKeyDown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				if (onSelect && !isFromOtherBranch && (event.ctrlKey || event.metaKey || event.shiftKey)) {
					onSelect({ shiftKey: event.shiftKey });
					return;
				}
				onEdit(task);
			}
		}}
      >
        {/* Cross-branch indicator banner */}
        {isFromOtherBranch && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 -mx-1 -mt-1 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 rounded-t text-xs text-amber-700 dark:text-amber-300">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="truncate">
              From <span className="font-semibold">{task.branch}</span> branch
            </span>
          </div>
        )}

        {/* signals: pills row (priority, type, labels) with the id on the right. */}
        <div className="flex items-start gap-2 mb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {priorityBadge && (
              <span className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${priorityBadge.bg} ${priorityBadge.text}`}>
                {priorityBadge.label}
              </span>
            )}
            <TaskTypeBadge type={task.type} availableTypes={availableTypes} className="min-w-0" />
            <ProjectBadge project={task.project} availableProjects={availableProjects} className="min-w-0" />
            {task.labels.slice(0, 2).map(label => (
              <span key={label} className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${labelTone(label)}`}>
                {label}
              </span>
            ))}
            {task.labels.length > 2 && (
              <span className="px-1 py-1 text-[11px] text-gray-400 dark:text-gray-500">+{task.labels.length - 2}</span>
            )}
          </div>
          <span className="ml-auto shrink-0 pt-0.5 text-[13px] text-gray-400 dark:text-gray-400">{task.id}</span>
        </div>

        <h4 title={task.title} className={`font-semibold text-[15px] leading-snug line-clamp-4 ${
          isFromOtherBranch ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
        }`}>
          {task.title}
        </h4>
        {excerpt && (
          <p className="mt-1 text-[13px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-2">{excerpt}</p>
        )}

        {acceptanceCriteriaProgress && acceptanceCriteriaProgress.total > 0 && (() => {
          const pct = Math.round((acceptanceCriteriaProgress.checked / acceptanceCriteriaProgress.total) * 100);
          return (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[12px] text-gray-500 dark:text-gray-300 mb-1.5">
                <span>Progress</span>
                <span className="text-gray-400 dark:text-gray-400">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-circle bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-1.5 rounded-circle ${pct >= 100 ? 'bg-emerald-300' : 'bg-amber-300'}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })()}

        <div className="flex items-center justify-between gap-2 mt-4">
          <div className="flex -space-x-2">
            {task.assignee.slice(0, 4).map(who => (
              <span
                key={who}
                title={who}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-circle ring-2 ring-white dark:ring-gray-800 text-[11px] font-semibold text-white ${avatarTone(who)}`}
              >
                {who.replace(/^@/, '').slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[12px] text-gray-400 dark:text-gray-400">
            {task.reporter && (
              <a
                href={`?creator=${encodeURIComponent(task.reporter)}`}
                onClick={e => e.stopPropagation()}
                className="hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
                title={`Created by ${task.reporter}: show their tasks`}
              >
                by {task.reporter}
              </a>
            )}
            {task.dueDate && <span>Due <StoredDate value={task.dueDate} dateFormat={dateFormat} /></span>}
            {task.dependencies.length > 0 && (
              <span className="inline-flex items-center gap-1" title={`Depends on ${task.dependencies.join(', ')}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                {task.dependencies.length}
              </span>
            )}
            {acceptanceCriteriaProgress && acceptanceCriteriaProgress.total > 0 && (
              <span className="inline-flex items-center gap-1" title="Acceptance criteria">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {acceptanceCriteriaProgress.checked}/{acceptanceCriteriaProgress.total}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
