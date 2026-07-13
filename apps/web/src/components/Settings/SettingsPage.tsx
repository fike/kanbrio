import { RulesPage } from './RulesPage';

interface SettingsPageProps {
  workspaceId: string;
}

export function SettingsPage(props: SettingsPageProps) {
  return <RulesPage workspaceId={props.workspaceId} />;
}
