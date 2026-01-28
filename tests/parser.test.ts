import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BujoParser } from '../src/parser';
import { BujoSignifier, Priority, DEFAULT_SETTINGS } from '../src/types';

// Mock TFile
const mockFile = {
  path: 'test.md',
  basename: 'test',
  extension: 'md',
  parent: { path: '' },
} as any;

// Mock Vault and MetadataCache
const mockVault = {} as any;
const mockMetadataCache = {} as any;

describe('BujoParser', () => {
  let parser: BujoParser;

  beforeEach(() => {
    parser = new BujoParser(mockVault, mockMetadataCache, DEFAULT_SETTINGS);
  });

  describe('parseLine', () => {
    describe('task signifiers', () => {
      it('should parse incomplete task', () => {
        const result = parser.parseLine('- [ ] Test task', mockFile, 0);
        expect(result).not.toBeNull();
        expect(result?.signifier).toBe(BujoSignifier.TASK);
        expect(result?.content).toBe('Test task');
      });

      it('should parse completed task (lowercase x)', () => {
        const result = parser.parseLine('- [x] Completed task', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.TASK_COMPLETE);
      });

      it('should parse completed task (uppercase X)', () => {
        const result = parser.parseLine('- [X] Completed task', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.TASK_COMPLETE);
      });

      it('should parse migrated task', () => {
        const result = parser.parseLine('- [>] Migrated task', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.TASK_MIGRATED);
      });

      it('should parse scheduled task', () => {
        const result = parser.parseLine('- [<] Scheduled task', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.TASK_SCHEDULED);
      });

      it('should parse cancelled task', () => {
        const result = parser.parseLine('- [-] Cancelled task', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.TASK_CANCELLED);
      });
    });

    describe('event signifiers', () => {
      it('should parse pending event (lowercase o)', () => {
        const result = parser.parseLine('- [o] Team meeting', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.EVENT);
        expect(result?.content).toBe('Team meeting');
      });

      it('should parse done event (uppercase O)', () => {
        const result = parser.parseLine('- [O] Completed meeting', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.EVENT_DONE);
      });

      it('should parse cancelled event (~)', () => {
        const result = parser.parseLine('- [~] Cancelled meeting', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.EVENT_CANCELLED);
      });

      it('should distinguish between o and O (case sensitive)', () => {
        const pending = parser.parseLine('- [o] Pending', mockFile, 0);
        const done = parser.parseLine('- [O] Done', mockFile, 0);
        expect(pending?.signifier).toBe(BujoSignifier.EVENT);
        expect(done?.signifier).toBe(BujoSignifier.EVENT_DONE);
      });
    });

    describe('metadata parsing', () => {
      it('should parse due date with emoji', () => {
        const result = parser.parseLine('- [ ] Task 📅 2024-01-15', mockFile, 0);
        expect(result?.dueDate).toEqual(new Date('2024-01-15'));
        expect(result?.content).toBe('Task');
      });

      it('should parse due date with text format', () => {
        const result = parser.parseLine('- [ ] Task due:2024-01-15', mockFile, 0);
        expect(result?.dueDate).toEqual(new Date('2024-01-15'));
      });

      it('should parse scheduled date', () => {
        const result = parser.parseLine('- [ ] Task ⏳ 2024-02-20', mockFile, 0);
        expect(result?.scheduledDate).toEqual(new Date('2024-02-20'));
      });

      it('should parse created date', () => {
        const result = parser.parseLine('- [ ] Task ➕ 2024-01-01', mockFile, 0);
        expect(result?.createdDate).toEqual(new Date('2024-01-01'));
      });

      it('should parse high priority', () => {
        const result = parser.parseLine('- [ ] Important task ⏫', mockFile, 0);
        expect(result?.priority).toBe(Priority.HIGH);
      });

      it('should parse medium priority', () => {
        const result = parser.parseLine('- [ ] Normal task 🔼', mockFile, 0);
        expect(result?.priority).toBe(Priority.MEDIUM);
      });

      it('should parse low priority', () => {
        const result = parser.parseLine('- [ ] Low task 🔽', mockFile, 0);
        expect(result?.priority).toBe(Priority.LOW);
      });

      it('should parse tags', () => {
        const result = parser.parseLine('- [ ] Task #project #urgent', mockFile, 0);
        expect(result?.tags).toContain('project');
        expect(result?.tags).toContain('urgent');
      });

      it('should parse recurrence', () => {
        const result = parser.parseLine('- [ ] Daily standup 🔁 every day', mockFile, 0);
        expect(result?.recurrence).toBe('every day');
      });
    });

    describe('event metadata', () => {
      it('should parse start time with emoji', () => {
        const result = parser.parseLine('- [o] Meeting 🕐 14:30', mockFile, 0);
        expect(result?.startTime).toBe('14:30');
      });

      it('should parse start time with @', () => {
        const result = parser.parseLine('- [o] Meeting @09:00', mockFile, 0);
        expect(result?.startTime).toBe('09:00');
      });

      it('should parse time range', () => {
        const result = parser.parseLine('- [o] Meeting 14:00-15:30', mockFile, 0);
        expect(result?.startTime).toBe('14:00');
        expect(result?.endTime).toBe('15:30');
      });

      it('should parse location with emoji', () => {
        const result = parser.parseLine('- [o] Meeting 📍 Conference Room A', mockFile, 0);
        expect(result?.location).toBe('Conference Room A');
      });

      it('should parse location with text format', () => {
        const result = parser.parseLine('- [o] Meeting location:Zoom', mockFile, 0);
        expect(result?.location).toBe('Zoom');
      });
    });

    describe('edge cases', () => {
      it('should return null for non-task lines', () => {
        expect(parser.parseLine('Regular text', mockFile, 0)).toBeNull();
        expect(parser.parseLine('# Heading', mockFile, 0)).toBeNull();
        expect(parser.parseLine('- Not a checkbox', mockFile, 0)).toBeNull();
      });

      it('should handle asterisk list markers', () => {
        const result = parser.parseLine('* [ ] Task with asterisk', mockFile, 0);
        expect(result?.signifier).toBe(BujoSignifier.TASK);
      });

      it('should preserve indentation', () => {
        const result = parser.parseLine('    - [ ] Indented task', mockFile, 0);
        expect(result?.indentation).toBe(4);
      });

      it('should handle complex combined metadata', () => {
        const result = parser.parseLine(
          '- [ ] Complex task ⏫ 📅 2024-01-15 ⏳ 2024-01-10 #work #urgent',
          mockFile,
          0
        );
        expect(result?.priority).toBe(Priority.HIGH);
        expect(result?.dueDate).toEqual(new Date('2024-01-15'));
        expect(result?.scheduledDate).toEqual(new Date('2024-01-10'));
        expect(result?.tags).toContain('work');
        expect(result?.tags).toContain('urgent');
      });
    });
  });

  describe('getSignifierMarker', () => {
    it('should return correct markers for all signifiers', () => {
      expect(parser.getSignifierMarker(BujoSignifier.TASK)).toBe('[ ]');
      expect(parser.getSignifierMarker(BujoSignifier.TASK_COMPLETE)).toBe('[x]');
      expect(parser.getSignifierMarker(BujoSignifier.TASK_MIGRATED)).toBe('[>]');
      expect(parser.getSignifierMarker(BujoSignifier.TASK_SCHEDULED)).toBe('[<]');
      expect(parser.getSignifierMarker(BujoSignifier.TASK_CANCELLED)).toBe('[-]');
      expect(parser.getSignifierMarker(BujoSignifier.EVENT)).toBe('[o]');
      expect(parser.getSignifierMarker(BujoSignifier.EVENT_DONE)).toBe('[O]');
      expect(parser.getSignifierMarker(BujoSignifier.EVENT_CANCELLED)).toBe('[~]');
    });
  });
});
