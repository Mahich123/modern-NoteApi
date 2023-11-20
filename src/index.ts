import { getRequestListener, serve } from "@hono/node-server";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { createServer } from "node:http";

import {
  createNote,
  Note,
  deleteNote,
  getAll,
  getNote,
  updateNote,
  getPaginated,
  noteByText,
} from "./notes";
import { createNoteSchema, deleteNoteSchema, getPaginatedNotesSchema, getSingleNoteSchema, updateNoteRequestSchema } from "./schema";
import { rateLimit } from "./rate-limit";

const app = new Hono();

app.use("*", secureHeaders());

app.use("*", compress());

app.use(
  "*",
  cors({
    origin: ["https://seen.red"],
  }),
);

// TODO: Pagination

app.post("/", async (c) => {

  // CREATE
  let data : Note 

  try {
    data = await c.req.json();
  } catch (error) {
    console.error(error);
    c.status(400);
    return c.json({
      success: false,
      message: "Invalid JSON in the request body",
    });
  }


  const validation = createNoteSchema.safeParse(data)

  if(!validation.success) {
    return c.json({message: JSON.parse(validation.error.message)[0]})
  }

  const validatedData = validation.data


  let note: Note | undefined;
  let success = true;
  let message = "Note Created"

  try {
    note = await noteByText(data.text);
  } catch (error) {
    c.status(500);
    success = false;
    message = "Error connecting to the database.";
    console.error("Error connecting to DB.", error);
    return c.json({ success, message });
  }



  if (note) {
    return c.json({ message: "already exists" });
  }

  const newNote: Partial<Note> = {
    text: validatedData.text,
    date: validatedData.date ? new Date(validatedData.date) : new Date(),
  };

  let dbNote: Note ;

  try {
   dbNote = await createNote(newNote)
  } catch (error) {
    console.error(error);
    c.status(500);
    return c.json({ success: false, message: "Error in creating the note" });
  }

  

  return c.json({ message , note: dbNote });
});

app.get("/:id", async (c) => {
  // READ

  const result = getSingleNoteSchema.safeParse(c.req.param("id"));

  if (!result.success) {
    c.status(400);
    return c.json({
      success: false,
      message: JSON.parse(result.error.message)[0].message,
    });
  }

  const id = result.data;

  let note: Note | undefined;
  let success = true;
  let message = "A note found";

  try {
    note = await getNote(id);
  } catch (error) {
    c.status(500);
    success = false;
    message = "Error connecting to the database.";
    console.error("Error connecting to DB.", error);
    return c.json({ success, message });
  }

  if (!note) {
    c.status(404);
    return c.json({ success: false, message: "note not found" });
  }

  return c.json({ success, message, note });
});

app.put("/:id", async (c) => {
  // UPDATE
  const result = getSingleNoteSchema.safeParse(c.req.param("id"));

  let data: unknown;

  try {
    data = await c.req.json();
  } catch (error) {
    console.error(error);
    c.status(400);
    return c.json({
      success: false,
      message: "Invalid JSON in the request body",
    });
  }

  if (!result.success) {
    c.status(400);
    return c.json({
      success: false,
      message: JSON.parse(result.error.message)[0].message,
    });
  }

  const id = result.data;

  const validation = updateNoteRequestSchema.safeParse(data);

  if (!validation.success) {
    c.status(400);
    return c.json({
      success: false,
      message: JSON.parse(validation.error.message)[0],
    });
  }

  const validatedData = validation.data;

  let success = true;
  let message = "Successfully retrieved";
  let notes: Note | undefined;

  try {
    const found = await getNote(result.data)

    if(!found) {
      c.status(404)
      return c.json({
        message: "note not found"
      })
    }

    notes = found
  } catch (error) {
    c.status(500);
    success = false;
    message = "Error retrieving notes";
    console.error("Error connecting to DB.", error);
    return c.json({ success, message });
  }

  notes = {
    id: notes.id,
    text: validatedData.text || notes.text,
    date: new Date(validatedData.date || notes.date.getTime()),
  };

  try {
    await updateNote(notes.id, notes);
  } catch (error) {
    console.error(error);
    c.status(500);
    return c.json({ success: false, message: "Error in updating the note" });
  }

  return c.json({ success: true, message: "successfully updated" });
});

app.delete("/:id", async (c) => {
  // DELETE

  const res = deleteNoteSchema.safeParse(c.req.param("id"))

  if (!res.success) {
    c.status(400);
    return c.json({
      success: false,
      message: JSON.parse(res.error.message)[0].message,
    });
  }

  const id = res.data
  

  let success = true;
  let message = "Note Deleted";

  const found = getNote(res.data)

  if(!found) {
    c.status(404)
    return c.json({
      message: "not not found"
    })
  }


  deleteNote(id);

  return c.json({success, message});
});

app.get("/", async (c) => {
  let success = true;
  let message = "Successfully retrieved";
  let notes: Note[];

  const limit = parseInt(c.req.query("limit") || "10")
  const page = parseInt(c.req.query("page") ||"1")

  const result = getPaginatedNotesSchema.safeParse({limit, page})

  if(!result.success) {
    c.status(404)
    return c.json({
      success:false,
      message: JSON.parse(result.error.message)[0].message
    })
  }

  try {
     notes = await getPaginated(result.data)
  } catch (error) {
    c.status(500);
    success = false;
    message = "Error retrieving notes";
    console.error("Error connecting to DB.", error);
    notes = [];
  }

  return c.json({ success, message, notes });
}); // LIST

serve({
  fetch: app.fetch,
  createServer: () => {
    const rateLimiter = rateLimit();

    const server = createServer((req, res) => {
      if (rateLimiter.passed({ req, res })) {
        const requestListener = getRequestListener(app.fetch);
        requestListener(req, res);
      }
    });

    return server;
  },
});