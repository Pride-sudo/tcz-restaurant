import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { EmptyState } from '../components/common/ui';
export default function NotFound() {
  return <div className="container-x py-20"><EmptyState icon={<SearchX className="h-6 w-6" />} title="We could not find that page" text="The link may be old or mistyped." action={<Link to="/" className="btn btn-primary">Back to home</Link>} /></div>;
}
