import { z } from "zod";
import { notesSchema } from "./notes";

export const getPaginatedNotesSchema = z.object({
  limit:z.number().positive().min(1).max(500).optional().default(10),
  page: z.number().positive().min(1).optional().default(1)
})

export const getSingleNoteSchema = z
  .string()
  .max(15)
  .transform((noteIdString) => parseInt(noteIdString))
  .refine((noteId) => noteId > 0, {
    message: "note id must be greater than 0",
  });

export const updateNoteRequestSchema = z.object({
  text: z.string().min(5).max(5000).optional(),
  date: z.number().int().min(Date.now()).optional(),
});

export const createNoteSchema = z.object({
  text: z.string().min(5).max(5000),
  date: z.number().int().min(Date.now()).optional()
})

export const deleteNoteSchema = getSingleNoteSchema

export const notes = notesSchema;
