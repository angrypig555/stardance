class AddSignupConfirmationSentAtToRsvps < ActiveRecord::Migration[8.1]
  def change
    add_column :rsvps, :signup_confirmation_sent_at, :datetime
  end
end
