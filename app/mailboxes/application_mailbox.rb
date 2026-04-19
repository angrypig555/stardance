class ApplicationMailbox < ActionMailbox::Base
  routing(/^tracking@/i => :tracking)
  routing(/^hcb@/i => :hcb)
  routing(/^stardance\+rsvp@/i => :"rsvp/reply")
  routing all: :incinerate
end
