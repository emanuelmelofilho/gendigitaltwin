import { NavLink } from 'react-router-dom';

export const STEPS = [
  { n: 1, title: 'Objetivo', to: '/cadastro/1' },
  { n: 2, title: 'Perfil inicial', to: '/cadastro/2' },
  { n: 3, title: 'Rotina e recursos', to: '/cadastro/3' },
  { n: 4, title: 'Fontes externas', to: '/cadastro/4' },
  { n: 5, title: 'Validação', to: '/revisao' },
  { n: 6, title: 'Evolução', to: '/historico' },
];

export default function Stepper({ reached }) {
  return (
    <ol className="stepper">
      {STEPS.map((s) => (
        <li key={s.n} className={s.n <= reached ? 'reached' : ''}>
          <NavLink to={s.to}>
            <span className="num">{s.n}</span>
            <span>{s.title}</span>
          </NavLink>
        </li>
      ))}
    </ol>
  );
}
