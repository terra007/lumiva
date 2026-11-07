import { dienste } from "@/server/lumiva";

async function handler(req: Request) {
  const { auth } = await dienste();
  return auth.handler(req);
}

export { handler as GET, handler as POST };
