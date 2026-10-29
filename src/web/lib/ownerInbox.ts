import type { Task, TaskComment } from "../../types";

// signals: questions to the owner (signals-pm scripts/pm.py ask). A question is a comment carrying an `ask` marker;
// it is answered once a comment signed @owner follows it. This is the same rule `pm.py settle` applies.
const ASK_RE = /<!--\s*ask options="([^"]*)"(?:\s+recommend="([^"]*)")?\s*-->/;

export interface OwnerQuestion {
	task: Task;
	asker: string;
	asked: string;
	text: string;
	options: string[];
	recommend: string;
	answer?: TaskComment;
}

const OWNER = "@owner";

export function questionsOf(task: Task): OwnerQuestion[] {
	const comments = task.comments ?? [];
	const out: OwnerQuestion[] = [];
	comments.forEach((comment, index) => {
		const m = ASK_RE.exec(comment.body ?? "");
		if (!m) return;
		const answer = comments.slice(index + 1).find((c) => (c.author ?? "").trim() === OWNER);
		out.push({
			task,
			asker: comment.author ?? "",
			asked: comment.createdDate,
			text: (comment.body ?? "")
				.replace(ASK_RE, "")
				.replace(/\n+Options:.*$/s, "")
				.trim(),
			options: (m[1] ?? "")
				.split("|")
				.map((o) => o.trim())
				.filter(Boolean),
			recommend: (m[2] ?? "").trim(),
			answer,
		});
	});
	return out;
}

/** The newest question of each task that has no answer yet. */
export function pendingQuestions(tasks: Task[]): OwnerQuestion[] {
	return tasks
		.map((task) => questionsOf(task).at(-1))
		.filter((q): q is OwnerQuestion => Boolean(q) && !q?.answer)
		.sort((a, b) => a.asked.localeCompare(b.asked));
}

export function recentAnswers(tasks: Task[], days = 7): OwnerQuestion[] {
	const since = Date.now() - days * 86_400_000;
	return tasks
		.flatMap((task) => questionsOf(task).filter((q) => q.answer))
		.filter((q) => Date.parse(q.answer?.createdDate ?? "") >= since)
		.sort((a, b) => (b.answer?.createdDate ?? "").localeCompare(a.answer?.createdDate ?? ""));
}
