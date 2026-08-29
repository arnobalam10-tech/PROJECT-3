import { Text, View } from "@react-pdf/renderer";

// Walks a Tiptap JSON document (the same shape stored in memos.body — see
// RichTextEditor) into @react-pdf elements. Covers exactly the node/mark
// types reachable through the editor's toolbar (paragraph, bold, italic,
// bulletList/orderedList, link) plus hardBreak, since that's the only path
// real content can be created through. Anything else (a node type that
// could only arrive via direct API/DB access, not the UI) falls back to
// rendering its plain text rather than being silently dropped.

type TiptapNode = {
  type?: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: TiptapNode[];
};

function renderTextRuns(nodes: TiptapNode[] | undefined, keyPrefix: string) {
  return (nodes ?? []).map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    if (node.type === "hardBreak") {
      return "\n";
    }
    if (node.type !== "text" || !node.text) {
      return null;
    }
    const isBold = node.marks?.some((m) => m.type === "bold");
    const isItalic = node.marks?.some((m) => m.type === "italic");
    const isLink = node.marks?.some((m) => m.type === "link");
    return (
      <Text
        key={key}
        style={{
          fontWeight: isBold ? 700 : 400,
          fontStyle: isItalic ? "italic" : "normal",
          textDecoration: isLink ? "underline" : undefined,
        }}
      >
        {node.text}
      </Text>
    );
  });
}

function flattenPlainText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(flattenPlainText).join("");
}

export function renderTiptapBody(doc: TiptapNode | null | undefined) {
  const blocks = doc?.content ?? [];
  if (blocks.length === 0) {
    return <Text style={{ color: "#666" }}>(no content)</Text>;
  }

  return (
    <View>
      {blocks.map((block, i) => {
        const key = `block-${i}`;
        if (block.type === "paragraph") {
          return (
            <Text key={key} style={{ marginBottom: 8, lineHeight: 1.4 }}>
              {renderTextRuns(block.content, key)}
            </Text>
          );
        }
        if (block.type === "bulletList" || block.type === "orderedList") {
          const ordered = block.type === "orderedList";
          return (
            <View key={key} style={{ marginBottom: 8 }}>
              {(block.content ?? []).map((item, j) => (
                <View key={`${key}-${j}`} style={{ flexDirection: "row", marginBottom: 2 }}>
                  <Text style={{ width: 16 }}>{ordered ? `${j + 1}.` : "•"}</Text>
                  <Text style={{ flex: 1, lineHeight: 1.4 }}>
                    {renderTextRuns(
                      (item.content ?? []).flatMap((p) => p.content ?? []),
                      `${key}-${j}`,
                    )}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        // Fallback for any node type not reachable through the editor UI —
        // render its flattened plain text rather than dropping it silently.
        const text = flattenPlainText(block);
        return text ? (
          <Text key={key} style={{ marginBottom: 8, lineHeight: 1.4 }}>
            {text}
          </Text>
        ) : null;
      })}
    </View>
  );
}
