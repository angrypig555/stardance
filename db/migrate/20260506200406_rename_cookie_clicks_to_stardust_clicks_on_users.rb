class RenameCookieClicksToStardustClicksOnUsers < ActiveRecord::Migration[8.1]
  def change
    safety_assured { rename_column :users, :cookie_clicks, :stardust_clicks }
  end
end
