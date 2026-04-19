class AddReplyConfirmedAtToRsvps < ActiveRecord::Migration[8.1]
  def change
    add_column :rsvps, :reply_confirmed_at, :datetime
  end
end
