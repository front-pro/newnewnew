import { NextResponse } from "next/server";
import { appendAuditEvent, consumeAuthRateLimit, currentUser, publicUser, readStore, readUserAudit, withStoreLock } from "../_lib";

export const GET = (request: Request) => withStoreLock(async () => {
  const store = await readStore();
  const user = await currentUser(request, store);
  if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  const limit = await consumeAuthRateLimit(request, user.email, 3, 60 * 60 * 1000, "account-export");
  if (limit.limited) return NextResponse.json({ error: "Экспорт сұрауы тым көп. Кейінірек қайталап көріңіз." }, { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": String(limit.retryAfter) } });

  const personalDocuments = store.documents.filter(document => document.owner === user.email && !document.workspaceId);
  const workspaceMemberships = store.memberships.filter(item => item.userId === user.id).map(membership => {
    const workspace = store.workspaces.find(item => item.id === membership.workspaceId);
    return workspace ? { id: workspace.id, name: workspace.name, createdAt: workspace.createdAt, role: membership.role, joinedAt: membership.joinedAt } : null;
  }).filter(Boolean);
  const groupMemberships = store.groups.filter(group => group.members.includes(user.id)).map(group => ({ id: group.id, workspaceId: group.workspaceId, name: group.name, description: group.description }));
  const approvals = store.approvals.flatMap(flow => {
    const ownSteps = flow.steps.filter(step => step.approverId === user.id);
    if (flow.requestedBy !== user.id && !ownSteps.length) return [];
    return [{ id: flow.id, documentId: flow.documentId, workspaceId: flow.workspaceId || null, requestedBy: flow.requestedBy, requestedAt: flow.requestedAt, version: flow.version, status: flow.status, steps: flow.requestedBy === user.id ? flow.steps : ownSteps }];
  });
  const exportData = {
    format: "kt-docs-account-export",
    version: 1,
    generatedAt: new Date().toISOString(),
    account: publicUser(user),
    personalDocuments,
    legacyDraft: store.docs[user.email] || null,
    legacyDraftVersion: store.versions[user.email] || null,
    templatesCreated: store.templates.filter(template => template.owner === user.email),
    analyses: Object.fromEntries(Object.entries(store.analyses).filter(([, analysis]) => analysis.owner === user.email)),
    activity: store.log.filter(entry => entry.owner === user.email),
    activityTrash: store.historyTrash.filter(entry => entry.owner === user.email),
    securityAudit: await readUserAudit(user.id, 5000),
    workspaceMemberships,
    groupMemberships,
    approvals,
    commentsAuthored: store.documents.flatMap(document => (document.comments || []).filter(comment => comment.author === user.email).map(comment => ({ documentId: document.id, documentTitle: document.title, ...comment }))),
    pendingInvitationsCreated: store.invitations.filter(invitation => invitation.invitedBy === user.id).map(invitation => ({ id: invitation.id, workspaceId: invitation.workspaceId, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, invitedBy: invitation.invitedBy })),
    notes: [
      "Personal documents and analysis history are included. Company document bodies are excluded to protect organization data.",
      "Original uploaded files are not retained by the current import flow and are not part of this export.",
      "Browser-only preferences and review decisions are not available to the server export.",
    ],
  };
  await appendAuditEvent({ actorId: user.id, action: "account.export", resourceType: "user", resourceId: user.id });
  const filename = `kt-docs-account-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kt-docs-account.json"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
