const FORUM_REPLY_KEY = "fg_forum_replies";
const FORUM_SAVED_KEY = "fg_forum_saved";

function getForumReplies() {
  try {
    const arr = JSON.parse(localStorage.getItem(FORUM_REPLY_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function setForumReplies(rows) {
  localStorage.setItem(FORUM_REPLY_KEY, JSON.stringify(rows.slice(0, 50)));
}

function renderForumState() {
  const box = document.getElementById("forum-replies");
  const saveBtn = document.getElementById("forum-save-btn");
  const replies = getForumReplies();
  const saved = localStorage.getItem(FORUM_SAVED_KEY) === "1";
  if (saveBtn) saveBtn.innerText = saved ? "Saved" : "Save";
  if (!box) return;
  if (!replies.length) {
    box.innerHTML = "No replies yet.";
    return;
  }
  box.innerHTML = replies
    .map((r) => `<p><strong>${escapeHtml(r.name)}</strong> • ${new Date(r.time).toLocaleString()}<br>${escapeHtml(r.text)}</p>`)
    .join("");
}
window.renderForumState = renderForumState;

function forumReply() {
  const name = (accountState.user?.name || "User").trim();
  const text = (window.prompt("Write your reply:") || "").trim();
  if (!text) return;
  const replies = getForumReplies();
  replies.unshift({ name, text, time: new Date().toISOString() });
  setForumReplies(replies);
  renderForumState();
}
window.forumReply = forumReply;

async function forumShare() {
  const text = document.getElementById("forum-post-text")?.innerText || "Flood Guard community update";
  const payload = { title: "Flood Guard Community Voice", text };
  try {
    if (navigator.share) {
      await navigator.share(payload);
    } else {
      await navigator.clipboard.writeText(`${payload.title}\n${text}`);
      alert("Post copied. You can paste and share.");
    }
  } catch (e) {
    console.log("Forum share cancelled/error", e);
  }
}
window.forumShare = forumShare;

function forumSave() {
  const current = localStorage.getItem(FORUM_SAVED_KEY) === "1";
  localStorage.setItem(FORUM_SAVED_KEY, current ? "0" : "1");
  renderForumState();
}
window.forumSave = forumSave;

function openFeedbackModal() {
  const modal = document.getElementById("feedback-modal");
  const status = document.getElementById("fb-status");
  const nameEl = document.getElementById("fb-name");
  if (nameEl && accountState.user?.name) nameEl.value = accountState.user.name;
  if (status) status.innerText = "Waiting...";
  if (modal) modal.style.display = "flex";
}
window.openFeedbackModal = openFeedbackModal;

function closeFeedbackModal() {
  const modal = document.getElementById("feedback-modal");
  if (modal) modal.style.display = "none";
}
window.closeFeedbackModal = closeFeedbackModal;

async function submitFeedback() {
  const name = (document.getElementById("fb-name")?.value || "").trim();
  const message = (document.getElementById("fb-message")?.value || "").trim();
  const status = document.getElementById("fb-status");
  if (!name || !message) {
    if (status) status.innerText = "Please enter name and feedback.";
    return;
  }
  if (status) status.innerText = "Saving feedback...";

  const loc = `${activeLat.toFixed(4)}, ${activeLon.toFixed(4)} | ${latestLocationIntel?.district || latestLocationIntel?.state || "Selected Area"}`;
  try {
    const res = await fetch(`${BACKEND_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, location: loc }),
    });
    const data = await res.json();
    if (!res.ok || data.status !== "success") {
      throw new Error(data?.message || "Feedback save failed");
    }
    if (status) status.innerText = "Feedback saved successfully.";
    const msg = document.getElementById("fb-message");
    if (msg) msg.value = "";
  } catch (e) {
    if (status) status.innerText = `Error: ${e.message || "Unable to save feedback."}`;
  }
}
window.submitFeedback = submitFeedback;

async function loadFeedbackManager() {
  const box = document.getElementById("feedback-admin");
  if (!box) return;
  box.innerHTML = "Loading feedback...";
  try {
    const res = await fetch(`${BACKEND_URL}/api/feedback?limit=300`);
    const data = await res.json();
    const rows = Array.isArray(data.feedback) ? data.feedback : [];
    if (!rows.length) {
      box.innerHTML = "No feedback yet.";
      return;
    }
    box.innerHTML = rows
      .map((f) => {
        const m = f.management || {};
        const status = (m.status || "open").toUpperCase();
        const responseText = m.response ? `<p><strong>Response:</strong> ${escapeHtml(m.response)}</p>` : "";
        const when = f.created_at ? new Date(f.created_at).toLocaleString() : "--";
        return `<div class="contact-list">
          <p><strong>${escapeHtml(f.name || "User")}</strong> • ${when}</p>
          <p>${escapeHtml(f.message || "")}</p>
          <p><strong>Location:</strong> ${escapeHtml(f.location || "N/A")} | <strong>Status:</strong> ${status}</p>
          ${responseText}
          <button onclick="respondFeedback('${escapeHtml(f.id)}','reviewed')">Reply</button>
          <button onclick="respondFeedback('${escapeHtml(f.id)}','resolved')">Mark Resolved</button>
        </div>`;
      })
      .join("");
  } catch (e) {
    box.innerHTML = `Unable to load feedback: ${escapeHtml(e?.message || "error")}`;
  }
}
window.loadFeedbackManager = loadFeedbackManager;

async function respondFeedback(feedbackId, status) {
  const response = (window.prompt(`Write your ${status} response:`) || "").trim();
  if (!response) return;
  try {
    const responder = accountState.user?.name || "admin";
    const res = await fetch(`${BACKEND_URL}/api/feedback/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback_id: feedbackId, response, responder, status }),
    });
    const data = await res.json();
    if (!res.ok || data.status !== "success") throw new Error(data?.message || "Failed to respond");
    loadFeedbackManager();
  } catch (e) {
    alert(`Unable to save response: ${e.message || "error"}`);
  }
}
window.respondFeedback = respondFeedback;

window.addEventListener("DOMContentLoaded", () => {
  renderForumState();
});
