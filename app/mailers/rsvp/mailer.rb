class Rsvp::Mailer < ApplicationMailer
  def signup_confirmation(rsvp)
    @email = rsvp.email
    @confirmation_url = confirm_rsvp_url(token: rsvp.confirmation_token)
    # The "to" address is required by Action Mailer but will be overwritten
    # by the email provided in the view. A subject is also not required here
    # as Loops will use the subject from the editor.
    mail(to: @email, reply_to: "stardance+rsvp@hackclub.com")
  end
end
