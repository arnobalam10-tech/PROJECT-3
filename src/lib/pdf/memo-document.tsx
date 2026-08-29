import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { renderTiptapBody } from "./tiptap-to-pdf";

// Palette matches DESIGN.md's Swiss/Basel system: near-black ink, one red
// accent reserved for the single most attention-worthy state (Rejected —
// same convention the app UI already uses for urgent priority), muted gray
// for secondary/meta text. No other hues, no rounded corners/shadows.
const INK = "#111111";
const MUTED = "#8A867E";
const RED = "#E32213";
const BORDER = "#111111";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  orgName: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginBottom: 4 },
  memoNumber: { fontSize: 9, color: MUTED, marginBottom: 2 },
  subject: { fontSize: 20, fontWeight: 700, marginBottom: 12 },
  statusBadge: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 16 },
  metaRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDER, borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 8, marginBottom: 16 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 7, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginBottom: 2 },
  metaValue: { fontSize: 10 },
  sectionTitle: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginTop: 18, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#CCCCCC" },
  small: { fontSize: 8, color: MUTED },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7, color: MUTED, textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#CCCCCC", paddingTop: 6 },
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "In Progress",
  pending_review: "In Progress",
  pending_approval: "In Progress",
  changes_requested: "In Progress — Changes Requested",
  rejected: "Rejected",
  approved: "Approved",
  cancelled: "Cancelled",
};

function statusColor(status: string) {
  if (status === "rejected") return RED;
  if (status === "approved") return INK;
  return MUTED;
}

export type MemoPdfData = {
  organizationName: string;
  memoNumber: string;
  subject: string;
  body: Record<string, unknown>;
  status: string;
  priority: string;
  authorName: string;
  authorEmail: string;
  departmentName: string | null;
  categoryName: string | null;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  attachments: { fileName: string; fileSize: number }[];
  workflowSteps: {
    holderName: string;
    isOriginal: boolean;
    status: string;
    actionTaken: string | null;
    comment: string | null;
    actedAt: string | null;
    actedByName: string | null;
  }[];
  comments: {
    authorName: string;
    onBehalfOfName: string | null;
    commentType: string;
    body: string;
    createdAt: string;
  }[];
  exportedByName: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MemoDocument(data: MemoPdfData) {
  return (
    <Document title={`${data.memoNumber} — ${data.subject}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.orgName}>{data.organizationName}</Text>
        <Text style={styles.memoNumber}>{data.memoNumber}</Text>
        <Text style={styles.subject}>{data.subject}</Text>
        <Text style={[styles.statusBadge, { color: statusColor(data.status) }]}>
          {STATUS_LABELS[data.status] ?? data.status}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Author</Text>
            <Text style={styles.metaValue}>{data.authorName}</Text>
            <Text style={styles.small}>{data.authorEmail}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Department</Text>
            <Text style={styles.metaValue}>{data.departmentName ?? "—"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Category</Text>
            <Text style={styles.metaValue}>{data.categoryName ?? "—"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Priority</Text>
            <Text style={[styles.metaValue, data.priority === "urgent" ? { color: RED } : {}]}>
              {data.priority}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>{fmtDate(data.createdAt)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Submitted</Text>
            <Text style={styles.metaValue}>{fmtDate(data.submittedAt)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Completed</Text>
            <Text style={styles.metaValue}>{fmtDate(data.completedAt)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Body</Text>
        {renderTiptapBody(data.body)}

        <Text style={styles.sectionTitle}>Attachments</Text>
        {data.attachments.length === 0 && <Text style={styles.small}>None.</Text>}
        {data.attachments.map((a, i) => (
          <View key={i} style={styles.row}>
            <Text>{a.fileName}</Text>
            <Text style={styles.small}>{fmtBytes(a.fileSize)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Workflow Participants &amp; Approval History</Text>
        {data.workflowSteps.length === 0 && <Text style={styles.small}>Not yet submitted.</Text>}
        {data.workflowSteps.map((s, i) => (
          <View key={i} style={{ marginBottom: 6 }}>
            <View style={styles.row}>
              <Text>
                {s.holderName}
                {!s.isOriginal ? " (added mid-workflow)" : ""}
              </Text>
              <Text style={{ textTransform: "uppercase", fontSize: 8 }}>{s.status.replace("_", " ")}</Text>
            </View>
            {s.actedAt && (
              <Text style={styles.small}>
                {s.actionTaken ?? "acted"} on {fmtDate(s.actedAt)}
                {s.actedByName && s.actedByName !== s.holderName
                  ? ` (acted by ${s.actedByName} on behalf of ${s.holderName})`
                  : ""}
                {s.comment ? ` — "${s.comment}"` : ""}
              </Text>
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Comments</Text>
        {data.comments.length === 0 && <Text style={styles.small}>None.</Text>}
        {data.comments.map((c, i) => (
          <View key={i} style={{ marginBottom: 6 }}>
            <Text style={styles.small}>
              {c.authorName}
              {c.onBehalfOfName ? ` (on behalf of ${c.onBehalfOfName})` : ""} · {c.commentType} ·{" "}
              {fmtDate(c.createdAt)}
            </Text>
            <Text>{c.body}</Text>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          Exported by {data.exportedByName} on {new Date().toLocaleString()} — Relay
        </Text>
      </Page>
    </Document>
  );
}
