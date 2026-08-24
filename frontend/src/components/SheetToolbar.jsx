import { Undo2, Redo2, Check, Loader2, AlertTriangle, Copy, Scissors, ClipboardPaste } from "lucide-react";
import { Button } from "./ui/button";

const label = {
  idle: "ALL SAVED",
  dirty: "SAVING SOON…",
  saving: "SAVING…",
  saved: "SAVED",
  error: "SAVE FAILED",
};

export const SheetToolbar = ({ sheet, prefix = "" }) => (
  <div className="flex items-center gap-2 uppercase">
    <Button
      variant="outline"
      size="sm"
      data-testid={`${prefix}undo-btn`}
      disabled={!sheet.canUndo}
      onClick={sheet.undo}
      title="Cmd/Ctrl + Z"
    >
      <Undo2 className="h-4 w-4 mr-1" /> UNDO
    </Button>
    <Button
      variant="outline"
      size="sm"
      data-testid={`${prefix}redo-btn`}
      disabled={!sheet.canRedo}
      onClick={sheet.redo}
      title="Cmd/Ctrl + R"
    >
      <Redo2 className="h-4 w-4 mr-1" /> REDO
    </Button>
    <Button
      variant="outline"
      size="sm"
      data-testid={`${prefix}copy-btn`}
      disabled={!sheet.hasSelection}
      onClick={sheet.copySelection}
      title="Cmd/Ctrl + C"
    >
      <Copy className="h-4 w-4 mr-1" /> COPY
    </Button>
    <Button
      variant="outline"
      size="sm"
      data-testid={`${prefix}cut-btn`}
      disabled={!sheet.hasSelection}
      onClick={sheet.cutSelection}
      title="Cmd/Ctrl + X"
    >
      <Scissors className="h-4 w-4 mr-1" /> CUT
    </Button>
    <Button
      variant="outline"
      size="sm"
      data-testid={`${prefix}paste-btn`}
      disabled={!sheet.hasSelection}
      onClick={sheet.pasteSelection}
      title="Cmd/Ctrl + V"
    >
      <ClipboardPaste className="h-4 w-4 mr-1" /> PASTE
    </Button>
    <span
      data-testid={`${prefix}save-status`}
      className={`flex items-center gap-1.5 text-xs tracking-wide px-2 py-1.5 rounded-md border ${
        sheet.status === "error"
          ? "text-destructive border-destructive/40"
          : "text-muted-foreground border-border"
      }`}
    >
      {sheet.status === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {sheet.status === "error" && <AlertTriangle className="h-3.5 w-3.5" />}
      {(sheet.status === "idle" || sheet.status === "saved") && <Check className="h-3.5 w-3.5" />}
      {label[sheet.status]}
    </span>
  </div>
);
