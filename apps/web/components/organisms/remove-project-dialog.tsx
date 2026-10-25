import { Button } from "@/components/atoms/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/atoms/dialog";

export type RemoveProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  taskCount: number | undefined;
  removing: boolean;
  error: string | null;
  onRemove: () => void;
};

export function RemoveProjectDialog({
  open,
  onOpenChange,
  projectName,
  taskCount,
  removing,
  error,
  onRemove,
}: RemoveProjectDialogProps) {
  const tasks =
    taskCount === undefined
      ? "Its tasks"
      : `Its ${taskCount} ${taskCount === 1 ? "task" : "tasks"}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Remove {projectName}?</DialogTitle>
        <DialogDescription>
          {tasks}, their runs and the environment are deleted from CodeGenie.
          The repository and its pull requests on GitHub are not touched.
        </DialogDescription>
        {error && (
          <p role="alert" className="text-[13px] text-err">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <DialogClose asChild>
            <Button size="sm">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            variant="danger"
            busy={removing}
            onClick={onRemove}
            className="border-transparent bg-err text-white hover:bg-err/90"
          >
            Remove project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
