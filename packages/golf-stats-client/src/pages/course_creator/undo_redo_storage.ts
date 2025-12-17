import { db, type UndoRedoStackItem } from '~/lib/db';

const MAX_STACK_SIZE = 20;

export class UndoRedoStorage {
  private courseId: number;
  private holeNumber: number;

  constructor(courseId: number, holeNumber: number) {
    this.courseId = courseId;
    this.holeNumber = holeNumber;
  }

  /**
   * Push a new state to the undo stack
   */
  async pushUndo(
    state: GeoJSON.FeatureCollection, 
    holeMetadata: UndoRedoStackItem['holeMetadata']
  ): Promise<void> {
    const timestamp = Date.now();
    
    // Get current max sequence index for undo stack
    const maxSeq = await this.getMaxSequenceIndex('undo');
    
    // Add new item to undo stack
    await db.undoRedoStacks.add({
      courseId: this.courseId,
      holeNumber: this.holeNumber,
      stackType: 'undo',
      state,
      holeMetadata,
      timestamp,
      sequenceIndex: maxSeq + 1,
    });

    // Trim stack to max size
    await this.trimStack('undo');
    
    // Clear redo stack when new action is performed
    await this.clearStack('redo');
  }

  /**
   * Pop from undo stack and push current state to redo stack
   */
  async popUndo(
    currentState: GeoJSON.FeatureCollection,
    currentHoleMetadata: UndoRedoStackItem['holeMetadata']
  ): Promise<{ state: GeoJSON.FeatureCollection; holeMetadata: UndoRedoStackItem['holeMetadata'] } | null> {
    // Get the latest undo state
    const undoState = await this.getLatestStackItem('undo');
    if (!undoState) return null;

    // Push current state to redo stack
    await this.pushRedo(currentState, currentHoleMetadata);

    // Remove the undo state from stack
    await db.undoRedoStacks.delete(undoState.id!);

    return { 
      state: undoState.state, 
      holeMetadata: undoState.holeMetadata 
    };
  }

  /**
   * Push a state to the redo stack (internal use)
   */
  private async pushRedo(
    state: GeoJSON.FeatureCollection,
    holeMetadata: UndoRedoStackItem['holeMetadata']
  ): Promise<void> {
    const timestamp = Date.now();
    
    // Get current max sequence index for redo stack
    const maxSeq = await this.getMaxSequenceIndex('redo');
    
    // Add new item to redo stack
    await db.undoRedoStacks.add({
      courseId: this.courseId,
      holeNumber: this.holeNumber,
      stackType: 'redo',
      state,
      holeMetadata,
      timestamp,
      sequenceIndex: maxSeq + 1,
    });

    // Trim stack to max size
    await this.trimStack('redo');
  }

  /**
   * Pop from redo stack and push current state to undo stack
   */
  async popRedo(
    currentState: GeoJSON.FeatureCollection,
    currentHoleMetadata: UndoRedoStackItem['holeMetadata']
  ): Promise<{ state: GeoJSON.FeatureCollection; holeMetadata: UndoRedoStackItem['holeMetadata'] } | null> {
    // Get the latest redo state
    const redoState = await this.getLatestStackItem('redo');
    if (!redoState) return null;

    // Push current state to undo stack
    await this.pushUndo(currentState, currentHoleMetadata);

    // Remove the redo state from stack
    await db.undoRedoStacks.delete(redoState.id!);

    return { 
      state: redoState.state, 
      holeMetadata: redoState.holeMetadata 
    };
  }

  /**
   * Check if undo is available
   */
  async canUndo(): Promise<boolean> {
    const count = await db.undoRedoStacks
      .where('[courseId+holeNumber+stackType]')
      .equals([this.courseId, this.holeNumber, 'undo'])
      .count();
    return count > 0;
  }

  /**
   * Check if redo is available
   */
  async canRedo(): Promise<boolean> {
    const count = await db.undoRedoStacks
      .where('[courseId+holeNumber+stackType]')
      .equals([this.courseId, this.holeNumber, 'redo'])
      .count();
    return count > 0;
  }

  /**
   * Clear both undo and redo stacks
   */
  async clearAll(): Promise<void> {
    await this.clearStack('undo');
    await this.clearStack('redo');
  }

  /**
   * Get the stack sizes for debugging
   */
  async getStackSizes(): Promise<{ undoSize: number; redoSize: number }> {
    const [undoSize, redoSize] = await Promise.all([
      db.undoRedoStacks
        .where('[courseId+holeNumber+stackType]')
        .equals([this.courseId, this.holeNumber, 'undo'])
        .count(),
      db.undoRedoStacks
        .where('[courseId+holeNumber+stackType]')
        .equals([this.courseId, this.holeNumber, 'redo'])
        .count(),
    ]);

    return { undoSize, redoSize };
  }

  /**
   * Clear a specific stack type
   */
  private async clearStack(stackType: 'undo' | 'redo'): Promise<void> {
    await db.undoRedoStacks
      .where('[courseId+holeNumber+stackType]')
      .equals([this.courseId, this.holeNumber, stackType])
      .delete();
  }

  /**
   * Get the latest item from a stack
   */
  private async getLatestStackItem(stackType: 'undo' | 'redo'): Promise<UndoRedoStackItem | undefined> {
    const items = await db.undoRedoStacks
      .where('[courseId+holeNumber+stackType]')
      .equals([this.courseId, this.holeNumber, stackType])
      .toArray();
    
    // Sort by sequence index and return the latest
    if (items.length === 0) return undefined;
    return items.sort((a, b) => b.sequenceIndex - a.sequenceIndex)[0];
  }

  /**
   * Get the maximum sequence index for a stack type
   */
  private async getMaxSequenceIndex(stackType: 'undo' | 'redo'): Promise<number> {
    const latest = await this.getLatestStackItem(stackType);
    return latest?.sequenceIndex ?? 0;
  }

  /**
   * Trim stack to maximum size, removing oldest items
   */
  private async trimStack(stackType: 'undo' | 'redo'): Promise<void> {
    const items = await db.undoRedoStacks
      .where('[courseId+holeNumber+stackType]')
      .equals([this.courseId, this.holeNumber, stackType])
      .toArray();

    if (items.length > MAX_STACK_SIZE) {
      // Sort by sequence index (newest first) and remove oldest items
      const sortedItems = items.sort((a, b) => b.sequenceIndex - a.sequenceIndex);
      const itemsToRemove = sortedItems.slice(MAX_STACK_SIZE);
      const idsToRemove = itemsToRemove.map((item: UndoRedoStackItem) => item.id!);
      await db.undoRedoStacks.bulkDelete(idsToRemove);
    }
  }
}

/**
 * Utility function to create a storage instance for a specific course hole
 */
export function createUndoRedoStorage(courseId: number, holeNumber: number): UndoRedoStorage {
  return new UndoRedoStorage(courseId, holeNumber);
}