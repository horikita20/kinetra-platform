import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export let db: any;
export let pool: any;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  console.warn("DATABASE_URL is not set. Falling back to an in-memory mock database.");
  
  // In-memory mock database store
  const mockSessions: any[] = [];

  const findUUID = (obj: any): string | undefined => {
    if (typeof obj === "string") {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(obj)) return obj;
    }
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (key === "table" || key === "config" || key === "metadata") continue;
        const res = findUUID(obj[key]);
        if (res) return res;
      }
    }
    return undefined;
  };

  const findString = (obj: any): string | undefined => {
    if (typeof obj === "string" && obj !== "id" && obj !== "sessions" && obj !== "sessionsTable") {
      return obj;
    }
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (key === "table" || key === "config" || key === "metadata") continue;
        const res = findString(obj[key]);
        if (res) return res;
      }
    }
    return undefined;
  };

  db = {
    insert: (table: any) => ({
      values: async (data: any) => {
        const record = { ...data, createdAt: new Date() };
        mockSessions.push(record);
        return [record];
      }
    }),
    select: () => ({
      from: (table: any) => {
        const selectObj = {
          where: (condition: any) => {
            let targetId: string | undefined = findUUID(condition);
            if (!targetId && condition && typeof condition === "object") {
              targetId = condition.value ?? condition.right ?? condition.left;
              if (typeof targetId === "object" && targetId !== null) {
                targetId = (targetId as any).value ?? (targetId as any).right;
              }
            }
            if (!targetId) {
              targetId = findString(condition);
            }

            const filtered = mockSessions.filter(s => s.id === targetId);
            return {
              limit: async (val: number) => {
                return filtered.slice(0, val);
              }
            };
          },
          orderBy: (orderField: any) => {
            const sorted = [...mockSessions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            return {
              limit: async (val: number) => {
                return sorted.slice(0, val);
              }
            };
          },
          limit: async (val: number) => {
            return mockSessions.slice(0, val);
          }
        };
        return selectObj;
      }
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: async (condition: any) => {
          let targetId: string | undefined = findUUID(condition);
          if (!targetId && condition && typeof condition === "object") {
            targetId = condition.value ?? condition.right ?? condition.left;
            if (typeof targetId === "object" && targetId !== null) {
              targetId = (targetId as any).value ?? (targetId as any).right;
            }
          }
          if (!targetId) {
            targetId = findString(condition);
          }

          const idx = mockSessions.findIndex(s => s.id === targetId);
          if (idx !== -1) {
            mockSessions[idx] = { ...mockSessions[idx], ...data };
            return [mockSessions[idx]];
          }
          return [];
        }
      })
    })
  };
}

export * from "./schema";
