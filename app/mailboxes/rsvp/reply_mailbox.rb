class Rsvp::ReplyMailbox < ApplicationMailbox
  def process
    sender = mail.from.first.to_s.downcase.strip
    Rsvp.find_by(email: sender)&.confirm_reply!
  end
end
