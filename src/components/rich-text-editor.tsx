"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useCallback, useEffect } from "react";

type JSONContent = Record<string, unknown>;

export function RichTextEditor({
  content,
  onChange,
  editable = true,
}: {
  content: JSONContent;
  onChange?: (json: JSONContent) => void;
  editable?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: Object.keys(content).length ? content : undefined,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[160px] border border-black px-3 py-2 outline-none prose-sm max-w-none focus:outline-2 focus:outline-black [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
  });

  useEffect(() => {
    if (editor && editable !== editor.isEditable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div>
      {editable && (
        <div className="mb-1 flex gap-1 border border-b-0 border-black p-1">
          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            B
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            I
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            •
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("link")} onClick={setLink}>
            link
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} className={editable ? "" : "border-transparent"} />
    </div>
  );
}

function ToolbarButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-7 border px-2 py-1 text-xs font-bold ${
        active ? "border-black bg-black text-white" : "border-transparent text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}
