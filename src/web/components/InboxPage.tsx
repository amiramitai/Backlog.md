import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../types';
import { apiClient } from '../lib/api';
import { pendingQuestions, recentAnswers, type OwnerQuestion } from '../lib/ownerInbox';

// signals: the owner's inbox — the Coordinator's backlog-refinement questions (signals-pm `pm.py ask`). An answer is a
// comment; the board's server signs it with BACKLOG_REPORTER (@owner), and `pm.py settle` clears the question within
// a minute (a task held for it goes back to Ready).

interface InboxPageProps {
  tasks: Task[];
  onRefreshData?: () => Promise<void> | void;
}

const when = (iso: string) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const hours = Math.round((Date.now() - t) / 3_600_000);
  return hours < 1 ? 'just now' : hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

const Question: React.FC<{ q: OwnerQuestion; onAnswered: () => void }> = ({ q, onAnswered }) => {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (choice: string) => {
    const body = [choice, note.trim()].filter(Boolean).join('\n\n');
    if (!body) return;
    setSending(choice || 'reply');
    setError(null);
    try {
      await apiClient.updateTask(q.task.id, { commentsAppend: [body] });
      onAnswered();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start gap-3 mb-2">
        <Link to={`/board/${q.task.id}`} className="text-[13px] text-gray-400 hover:underline shrink-0 pt-0.5">{q.task.id}</Link>
        <Link to={`/board/${q.task.id}`} className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 hover:underline">{q.task.title}</Link>
        <span className="ml-auto shrink-0 text-[12px] text-gray-400">{q.asker} · {when(q.asked)}</span>
      </div>
      <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap mb-3">{q.text}</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {q.options.map(option => (
          <button
            key={option}
            type="button"
            disabled={sending !== null}
            onClick={() => send(option)}
            className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors disabled:opacity-60 ${
              option === q.recommend
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100 hover:bg-gray-700 dark:hover:bg-white'
                : 'bg-white text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-500 hover:border-gray-400'
            }`}
          >
            {option}
            {option === q.recommend && <span className="ml-2 text-[11px] font-normal opacity-75">recommended</span>}
          </button>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Add a note (sent with your choice), or reply in words…"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        <button
          type="button"
          disabled={sending !== null || !note.trim()}
          onClick={() => send('')}
          className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 disabled:opacity-50"
        >
          Reply
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">Not sent: {error}</p>}
    </div>
  );
};

const InboxPage: React.FC<InboxPageProps> = ({ tasks, onRefreshData }) => {
  const pending = pendingQuestions(tasks);
  const answered = recentAnswers(tasks);
  const refresh = () => void onRefreshData?.();

  return (
    <div className="page-shell px-8 py-6 max-w-4xl">
      <h2 className="flex items-center gap-3 text-3xl font-medium tracking-tight text-gray-900 dark:text-gray-100 mb-1">
        Inbox
        <span className="text-xl text-gray-400">{pending.length}</span>
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        The Coordinator's backlog questions. Pick an option or reply; the task updates within a minute.
      </p>
      <div className="space-y-3 mb-10">
        {pending.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Nothing is waiting on you.</p>}
        {pending.map(q => <Question key={`${q.task.id}-${q.asked}`} q={q} onAnswered={refresh} />)}
      </div>
      {answered.length > 0 && (
        <>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Answered this week</h3>
          <ul className="space-y-2">
            {answered.map(q => (
              <li key={`${q.task.id}-${q.asked}`} className="text-sm text-gray-600 dark:text-gray-300">
                <Link to={`/board/${q.task.id}`} className="text-gray-400 hover:underline">{q.task.id}</Link>{' '}
                {q.text.split('\n')[0]} <span className="text-gray-400">→</span>{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">{(q.answer?.body ?? '').split('\n')[0]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default InboxPage;
