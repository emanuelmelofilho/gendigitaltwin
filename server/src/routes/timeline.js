import { Router } from 'express';
import { query } from '../db.js';

export const timelineRouter = Router();

// Linha do tempo única: mudanças em informações, decisões e resultados.
timelineRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM (
       SELECT 'informacao' AS type, v.created_at AS at,
              jsonb_build_object('informationId', i.id, 'category', i.category, 'key', i.key, 'value', v.value,
                                 'status', v.status, 'actor', v.actor, 'note', v.note, 'origin', i.origin) AS data
         FROM information_versions v JOIN informations i ON i.id = v.information_id
        WHERE i.person_id = $1 AND NOT (v.actor = 'sistema' AND v.status = 'pendente')
       UNION ALL
       SELECT 'decisao', d.decided_at, jsonb_build_object('id', d.id, 'title', d.title, 'chosen', d.chosen)
         FROM decisions d WHERE d.person_id = $1
       UNION ALL
       SELECT 'resultado', o.created_at,
              jsonb_build_object('decisionId', d.id, 'decisionTitle', d.title, 'description', o.description)
         FROM outcomes o JOIN decisions d ON d.id = o.decision_id WHERE d.person_id = $1
     ) t ORDER BY at DESC LIMIT 200`,
    [req.personId],
  );
  res.json(rows);
});
