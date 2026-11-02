import { randomUUID } from 'expo-crypto';

import { getDatabase } from '@/database/client';
import type { GoalSection, GoalSectionItem, GoalSectionItemInput } from '@/types/goals';

type SectionRow = { id: string; goal_id: string; title: string; planned_amount_cents: number | null };
type ItemRow = {
  id: string;
  section_id: string;
  title: string;
  url: string | null;
  price_cents: number | null;
  note: string | null;
  done: number;
};

/** All blocks of a goal with their ideas, in creation order (two queries, grouped in memory). */
export async function listGoalSections(goalId: string): Promise<GoalSection[]> {
  const database = await getDatabase();
  const [sections, items] = await Promise.all([
    database.getAllAsync<SectionRow>(
      `SELECT id, goal_id, title, planned_amount_cents FROM goal_sections
       WHERE goal_id = ? ORDER BY sort_order, created_at`,
      goalId,
    ),
    database.getAllAsync<ItemRow>(
      `SELECT i.id, i.section_id, i.title, i.url, i.price_cents, i.note, i.done
       FROM goal_section_items i JOIN goal_sections s ON s.id = i.section_id
       WHERE s.goal_id = ? ORDER BY i.sort_order, i.created_at`,
      goalId,
    ),
  ]);

  const itemsBySection = new Map<string, GoalSectionItem[]>();
  for (const row of items) {
    const list = itemsBySection.get(row.section_id) ?? [];
    list.push({
      id: row.id,
      sectionId: row.section_id,
      title: row.title,
      url: row.url,
      priceCents: row.price_cents,
      note: row.note,
      done: row.done === 1,
    });
    itemsBySection.set(row.section_id, list);
  }

  return sections.map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    plannedAmountCents: row.planned_amount_cents,
    items: itemsBySection.get(row.id) ?? [],
  }));
}

export async function createGoalSection(goalId: string, title: string, plannedAmountCents: number | null): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT INTO goal_sections (id, goal_id, title, planned_amount_cents, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM goal_sections WHERE goal_id = ?), ?, ?)`,
    randomUUID(),
    goalId,
    title,
    plannedAmountCents,
    goalId,
    now,
    now,
  );
}

export async function updateGoalSection(id: string, title: string, plannedAmountCents: number | null): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE goal_sections SET title = ?, planned_amount_cents = ?, updated_at = ? WHERE id = ?',
    title,
    plannedAmountCents,
    Date.now(),
    id,
  );
}

/** Deletes the block and its ideas (cascade). The goal's money is not affected. */
export async function deleteGoalSection(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM goal_sections WHERE id = ?', id);
}

export async function createSectionItem(sectionId: string, input: GoalSectionItemInput): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT INTO goal_section_items (id, section_id, title, url, price_cents, note, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM goal_section_items WHERE section_id = ?), ?, ?)`,
    randomUUID(),
    sectionId,
    input.title,
    input.url,
    input.priceCents,
    input.note,
    sectionId,
    now,
    now,
  );
}

export async function updateSectionItem(id: string, input: GoalSectionItemInput): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE goal_section_items SET title = ?, url = ?, price_cents = ?, note = ?, updated_at = ? WHERE id = ?',
    input.title,
    input.url,
    input.priceCents,
    input.note,
    Date.now(),
    id,
  );
}

export async function setSectionItemDone(id: string, done: boolean): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE goal_section_items SET done = ?, updated_at = ? WHERE id = ?',
    done ? 1 : 0,
    Date.now(),
    id,
  );
}

export async function deleteSectionItem(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM goal_section_items WHERE id = ?', id);
}
