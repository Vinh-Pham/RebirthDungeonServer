import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'react-email';
import type { CSSProperties } from 'react';

export interface TestEmailProps {
  recipientName?: string;
}

export const TEST_EMAIL_SUBJECT = 'Rebirth Dungeon email delivery test';

export default function TestEmail({
  recipientName = 'Adventurer',
}: TestEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>A test message from Rebirth Dungeon. No action needed.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={banner}>
            <Text style={brand}>REBIRTH DUNGEON</Text>
            <Heading style={heading}>A message from the dungeon</Heading>
          </Section>
          <Section style={content}>
            <Text style={paragraph}>Hello, {recipientName}!</Text>
            <Text style={paragraph}>
              This is a test of Rebirth Dungeon transactional email sending. If
              you are reading this, the test message has reached your inbox.
            </Text>
            <Text style={paragraph}>
              No action is needed. Your adventure is waiting for you.
            </Text>
            <Hr style={divider} />
            <Text style={footer}>Rebirth Dungeon · Email delivery test</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

TestEmail.PreviewProps = {
  recipientName: 'Adventurer',
} satisfies TestEmailProps;

const body: CSSProperties = {
  backgroundColor: '#f3f0e9',
  color: '#27231d',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: 0,
  padding: '32px 12px',
};
const container: CSSProperties = {
  backgroundColor: '#ffffff',
  maxWidth: '560px',
  border: '1px solid #ded7ca',
  borderRadius: '8px',
  overflow: 'hidden',
};
const banner: CSSProperties = {
  backgroundColor: '#202a25',
  padding: '24px 32px',
};
const brand: CSSProperties = {
  color: '#d9bd7c',
  fontSize: '12px',
  letterSpacing: '2px',
  fontWeight: 700,
  margin: '0 0 12px',
};
const heading: CSSProperties = {
  color: '#ffffff',
  fontSize: '26px',
  lineHeight: '34px',
  margin: 0,
};
const content: CSSProperties = { padding: '20px 32px 24px' };
const paragraph: CSSProperties = {
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
};
const divider: CSSProperties = {
  borderColor: '#e8e2d7',
  margin: '24px 0 16px',
};
const footer: CSSProperties = {
  color: '#716a5f',
  fontSize: '12px',
  lineHeight: '20px',
  margin: 0,
};
