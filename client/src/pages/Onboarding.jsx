import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Stepper, { STEPS } from '../components/Stepper.jsx';
import StepGoal from '../steps/StepGoal.jsx';
import StepProfile from '../steps/StepProfile.jsx';
import StepRoutine from '../steps/StepRoutine.jsx';
import StepSources from '../steps/StepSources.jsx';

const COMPONENTS = { 1: StepGoal, 2: StepProfile, 3: StepRoutine, 4: StepSources };

export default function Onboarding() {
  const step = Number(useParams().step);
  const { session, setPerson } = useAuth();
  const navigate = useNavigate();
  const Step = COMPONENTS[step];
  if (!Step) return <Navigate to="/cadastro/1" replace />;

  const next = async () => {
    setPerson(await api('/person', { method: 'PATCH', body: { onboardingStep: step + 1 } }));
    navigate(STEPS[step].to);
  };

  return (
    <>
      <Stepper reached={session.person.onboardingStep} />
      <section className="step">
        <h1>{step}. {STEPS[step - 1].title}</h1>
        <Step />
        <div className="actions">
          {step > 1 && <button onClick={() => navigate(STEPS[step - 2].to)}>Voltar</button>}
          <button className="primary" onClick={next}>Continuar</button>
        </div>
      </section>
    </>
  );
}
