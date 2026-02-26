"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import CharacterCount from "@tiptap/extension-character-count";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });

type Props = {
  content: string;
  onChange: (html: string, count: number) => void;
};

const FONT_OPTIONS = [
  { label: "標準", value: "" },
  { label: "ゴシック", value: "'Yu Gothic', 'Meiryo', sans-serif" },
  { label: "明朝", value: "'Hiragino Mincho ProN', serif" },
  { label: "丸ゴ", value: "'Hiragino Maru Gothic ProN', sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
];

export default function RichTextEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      Image.configure({ inline: false }),
      CharacterCount,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editorProps: {
      attributes: {
        class: "min-h-[220px] rounded-2xl border border-[var(--ui-line)] bg-[var(--page-bg)] p-3 text-[var(--page-text)] outline-none",
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !editor) return false;

        let handled = false;
        Array.from(items).forEach((item) => {
          const file = item.getAsFile();
          if (!file) return;

          if (item.type.startsWith("image/")) {
            handled = true;
            void readAsDataUrl(file).then((src) => {
              editor.chain().focus().setImage({ src, alt: file.name }).run();
            });
          }

          if (item.type === "application/pdf") {
            handled = true;
            void readAsDataUrl(file).then((src) => {
              const safeName = file.name.replace(/[<>"']/g, "");
              editor
                .chain()
                .focus()
                .insertContent(
                  `<p><a href="${src}" download="${safeName}">📄 ${safeName}</a></p>`
                )
                .run();
            });
          }
        });

        if (handled) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(
        currentEditor.getHTML(),
        currentEditor.storage.characterCount.characters()
      );
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (content === editor.getHTML()) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="rounded-2xl border border-[var(--ui-line)] bg-[var(--page-bg)] p-3">
        <textarea
          defaultValue={content.replace(/<[^>]*>/g, "")}
          onChange={(event) => {
            const safeText = event.target.value
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            onChange(`<p>${safeText.replace(/\n/g, "<br>")}</p>`, event.target.value.length);
          }}
          className="min-h-[220px] w-full rounded-2xl border border-[var(--ui-line)] bg-[var(--page-bg)] p-3 text-[var(--page-text)] outline-none"
        />
      </div>
    );
  }

  const currentCount = editor.storage.characterCount.characters();

  return (
    <div className="rounded-2xl border border-[var(--ui-line)] bg-[var(--page-bg)] p-3">
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded-xl px-3 py-1 text-sm ${
            editor.isActive("bold")
              ? "bg-[var(--ui-button)]"
              : "border border-[var(--ui-line)] bg-white"
          }`}
        >
          太字
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded-xl px-3 py-1 text-sm ${
            editor.isActive("heading", { level: 2 })
              ? "bg-[var(--ui-button)]"
              : "border border-[var(--ui-line)] bg-white"
          }`}
        >
          見出し
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded-xl px-3 py-1 text-sm ${
            editor.isActive("bulletList")
              ? "bg-[var(--ui-button)]"
              : "border border-[var(--ui-line)] bg-white"
          }`}
        >
          箇条書き
        </button>
        <button
          type="button"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className="rounded-xl border border-[var(--ui-line)] bg-white px-3 py-1 text-sm"
        >
          表を挿入
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className="rounded-xl border border-[var(--ui-line)] bg-white px-3 py-1 text-sm"
        >
          +行
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          className="rounded-xl border border-[var(--ui-line)] bg-white px-3 py-1 text-sm"
        >
          +列
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteTable().run()}
          className="rounded-xl border border-[var(--ui-line)] bg-white px-3 py-1 text-sm"
        >
          表削除
        </button>

        <select
          className="rounded-xl border border-[var(--ui-line)] bg-white px-2 py-1 text-sm"
          value={editor.getAttributes("textStyle").fontFamily || ""}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) {
              editor.chain().focus().unsetFontFamily().run();
              return;
            }
            editor.chain().focus().setFontFamily(value).run();
          }}
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <EditorContent editor={editor} />
      <p className="mt-2 text-right text-xs">文字数: {currentCount}</p>
      <p className="mt-1 text-xs">画像/PDFは貼り付け（Ctrl/Cmd+V）で追加できます。表はセルクリックで編集できます。</p>
    </div>
  );
}
