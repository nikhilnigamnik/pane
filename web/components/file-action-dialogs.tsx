import { COPY } from '@/config/copy';
import type { FileActionsState } from '@/web/hooks/use-file-actions';
import { entryNameError, nameSelectionEnd } from '@/web/lib/entry-name';
import { ROOT_PATH } from '@/web/lib/path';

import { ConfirmDialog } from './ui/confirm-dialog';
import { PromptDialog } from './ui/prompt-dialog';

interface FileActionDialogsProps {
  actions: FileActionsState;
  // Shown as the folder name when something is created at the top level.
  workspaceName: string;
}

export function FileActionDialogs({ actions, workspaceName }: FileActionDialogsProps) {
  const { dialog } = actions;
  const create = dialog?.kind === 'create' ? dialog : null;
  const rename = dialog?.kind === 'rename' ? dialog : null;
  const remove = dialog?.kind === 'delete' ? dialog : null;

  const createTitle = create?.entryKind === 'directory' ? COPY.NEW_FOLDER : COPY.NEW_FILE;
  const createFolder = create?.parentPath === ROOT_PATH ? workspaceName : create?.parentPath;
  const deleteDescription = [
    remove?.entry.kind === 'directory' ? COPY.DELETE_FOLDER_DESCRIPTION : COPY.DELETE_FILE_DESCRIPTION,
    remove?.hasUnsavedChanges ? COPY.DELETE_UNSAVED_WARNING : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <PromptDialog
        isOpen={create !== null}
        title={createTitle}
        description={createFolder === undefined ? undefined : COPY.CREATE_IN(createFolder)}
        label={COPY.ENTRY_NAME_LABEL}
        initialValue=""
        confirmLabel={COPY.CREATE_CONFIRM}
        cancelLabel={COPY.CANCEL}
        validate={entryNameError}
        onSubmit={actions.submitCreate}
        onCancel={actions.cancel}
      />
      <PromptDialog
        isOpen={rename !== null}
        title={COPY.RENAME_TITLE(rename?.entry.name ?? '')}
        label={COPY.ENTRY_NAME_LABEL}
        initialValue={rename?.entry.name ?? ''}
        selectionEnd={
          rename ? nameSelectionEnd(rename.entry.name, rename.entry.kind === 'directory') : undefined
        }
        confirmLabel={COPY.RENAME_CONFIRM}
        cancelLabel={COPY.CANCEL}
        validate={entryNameError}
        onSubmit={actions.submitRename}
        onCancel={actions.cancel}
      />
      <ConfirmDialog
        isOpen={remove !== null}
        title={COPY.DELETE_TITLE(remove?.entry.name ?? '')}
        description={deleteDescription}
        confirmLabel={COPY.DELETE_CONFIRM}
        cancelLabel={COPY.CANCEL}
        onConfirm={() => void actions.confirmDelete()}
        onCancel={actions.cancel}
      />
    </>
  );
}
