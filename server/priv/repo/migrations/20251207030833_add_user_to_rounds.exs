defmodule GolfStatsServer.Repo.Migrations.AddUserToRounds do
  use Ecto.Migration

  def change do
    alter table(:rounds) do
      add(:user_id, references(:users, on_delete: :delete_all))
    end

    create(index(:rounds, [:user_id]))
  end
end
