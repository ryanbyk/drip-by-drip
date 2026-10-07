import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AuthUser } from "../state/auth-context";
import { settingsSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";
import { Account } from "./Account";
import { Settings } from "./Settings";
import { SignIn } from "./SignIn";

const signedIn: AuthUser = {
  id: "story-user",
  email: "ryan@example.com",
  provider: "apple",
  displayName: "Ryan Bykowski",
};

function SignInScreen() {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone>
        <SignIn onSkip={() => undefined} preview={{ email: "", installed: false }} />
      </Phone>
    </StoryApp>
  );
}

function InstalledSignInScreen() {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone>
        <SignIn onSkip={() => undefined} preview={{ email: "", installed: true }} />
      </Phone>
    </StoryApp>
  );
}

function MagicLinkScreen() {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone>
        <SignIn
          onSkip={() => undefined}
          preview={{ email: "ryan@example.com", linkSent: true, resendSeconds: 42, installed: false }}
        />
      </Phone>
    </StoryApp>
  );
}

function EmailCodeScreen() {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone>
        <SignIn
          onSkip={() => undefined}
          preview={{ email: "ryan@example.com", codeSent: true, resendSeconds: 42, installed: true }}
        />
      </Phone>
    </StoryApp>
  );
}

function AccountScreen({ user }: { user: AuthUser | null }) {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot} authUser={user}>
      <Phone tab="settings">
        {user ? <Account onBack={() => undefined} /> : <Settings onSignIn={() => undefined} />}
      </Phone>
    </StoryApp>
  );
}

const meta = {
  title: "Screens/Account",
  parameters: { appFrame: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignInStory: Story = {
  name: "v1.5 · 1 · Sign in",
  render: () => <SignInScreen />,
};

export const InstalledSignInStory: Story = {
  name: "v1.5 · Sign in · installed",
  render: () => <InstalledSignInScreen />,
};

export const MagicLinkStory: Story = {
  name: "v1.5 · 2 · Magic link sent",
  render: () => <MagicLinkScreen />,
};

export const EmailCodeStory: Story = {
  name: "v1.5 · Code sent",
  render: () => <EmailCodeScreen />,
};

export const AccountGuest: Story = {
  name: "v1.5 · Account · guest",
  render: () => <AccountScreen user={null} />,
};

export const AccountSignedIn: Story = {
  name: "v1.5 · 3 · Account",
  render: () => <AccountScreen user={signedIn} />,
};

export const SettingsSignedIn: Story = {
  name: "v1.5 · 15 · Settings signed in",
  render: () => {
    const snapshot = useFixture(settingsSnapshot);
    return (
      <StoryApp snapshot={snapshot} authUser={signedIn}>
        <Phone tab="settings">
          <Settings onAccountOpen={() => undefined} onSignIn={() => undefined} />
        </Phone>
      </StoryApp>
    );
  },
};
