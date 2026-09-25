import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Hr,
} from 'react-email';

export type TestEmailProps = { recipientName?: string };

export default function TestEmail({
  recipientName = 'Adventurer',
}: TestEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        A test message from Rebirth Dungeon. No action required.
      </Preview>
      <Body
        style={{
          backgroundColor: '#f4f2ed',
          fontFamily: 'Arial, Helvetica, sans-serif',
          margin: 0,
          padding: '32px 16px',
          color: '#292724',
        }}
      >
        <Container
          style={{ maxWidth: '560px', width: '100%', margin: '0 auto' }}
        >
          <Text
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: '#706453',
              margin: '0 0 20px',
            }}
          >
            REBIRTH DUNGEON
          </Text>
          <Section
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5dfd5',
              borderRadius: '8px',
              padding: '32px 24px',
            }}
          >
            <Text
              style={{
                fontSize: '12px',
                color: '#806230',
                fontWeight: 700,
                margin: '0 0 12px',
              }}
            >
              TEST EMAIL
            </Text>
            <Heading
              as="h1"
              style={{
                fontSize: '28px',
                lineHeight: '36px',
                margin: '0 0 24px',
                fontWeight: 700,
              }}
            >
              A message from the dungeon.
            </Heading>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Hello, {recipientName}.
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              This is an example email from Rebirth Dungeon, created to test our
              email templates and sending setup.
            </Text>
            <Hr style={{ borderColor: '#e5dfd5', margin: '24px 0' }} />
            <Text
              style={{
                fontSize: '14px',
                lineHeight: '22px',
                color: '#625c53',
                margin: 0,
              }}
            >
              No action required. This test message does not change your account
              or game progress.
            </Text>
          </Section>
          <Text
            style={{
              fontSize: '12px',
              lineHeight: '20px',
              color: '#706453',
              margin: '20px 0 0',
            }}
          >
            Rebirth Dungeon · Example transactional email
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

TestEmail.PreviewProps = {
  recipientName: 'Adventurer',
} satisfies TestEmailProps;
