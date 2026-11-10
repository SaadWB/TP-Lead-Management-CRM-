import type { NextApiRequest, NextApiResponse } from 'next';
import app from '@/server/app';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    return (app as any)(req, res, (err: any) => {
      if (err) {
        console.error('[Express Next Error]', err);
        return res.status(500).json({ error: err.message || 'Express error', stack: err.stack });
      }
      res.status(404).json({ error: `Not found: ${req.url}` });
    });
  } catch (err: any) {
    console.error('[API Handler Error]', err);
    return res.status(500).json({ error: err.message || 'Handler error', stack: err.stack });
  }
}
