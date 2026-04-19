class AddClickConfirmationToRsvps < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :rsvps, :confirmation_token, :string
    add_column :rsvps, :click_confirmed_at, :datetime
    add_index :rsvps, :confirmation_token, unique: true, algorithm: :concurrently
  end
end
