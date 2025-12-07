defmodule GolfStatsServer.Repo.Migrations.AddUserToClubs do
  use Ecto.Migration

  def change do
    alter table(:clubs) do
      add(:user_id, references(:users, on_delete: :delete_all))
    end

    create(index(:clubs, [:user_id]))
    create(unique_index(:clubs, [:user_id, :name]))
  end
end
