require "test_helper"

class Rsvp::ReplyMailboxTest < ActionMailbox::TestCase
  self.fixture_table_names = []
  self.fixture_sets = {}
  test "reply from a known RSVP stamps reply_confirmed_at" do
    rsvp = Rsvp.create!(email: "fan@example.com")
    rsvp.update_column(:reply_confirmed_at, nil)

    receive_inbound_email_from_mail \
      to: "stardance+rsvp@hackclub.com",
      from: "fan@example.com",
      subject: "Re: welcome",
      body: "Hey Stardance"

    assert_not_nil rsvp.reload.reply_confirmed_at
  end

  test "reply with mixed-case sender still matches" do
    rsvp = Rsvp.create!(email: "loud@example.com")
    rsvp.update_column(:reply_confirmed_at, nil)

    receive_inbound_email_from_mail \
      to: "stardance+rsvp@hackclub.com",
      from: "LOUD@Example.com",
      subject: "Re: welcome",
      body: "hi"

    assert_not_nil rsvp.reload.reply_confirmed_at
  end

  test "reply from an unknown sender is a no-op" do
    assert_nothing_raised do
      receive_inbound_email_from_mail \
        to: "stardance+rsvp@hackclub.com",
        from: "stranger@example.com",
        subject: "Re: welcome",
        body: "who?"
    end

    assert_nil Rsvp.find_by(email: "stranger@example.com")
  end
end
