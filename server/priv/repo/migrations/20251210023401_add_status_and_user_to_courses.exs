defmodule GolfStatsServer.Repo.Migrations.AddStatusAndUserToCourses do
  use Ecto.Migration

  def change do
    alter table(:courses) do
      add(:status, :string, default: "draft", null: false)
      add(:user_id, references(:users, on_delete: :nilify_all))
    end

    create(index(:courses, [:user_id]))
    create(index(:courses, [:status]))
  end
end
