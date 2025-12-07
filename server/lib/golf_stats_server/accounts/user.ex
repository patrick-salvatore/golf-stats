defmodule GolfStatsServer.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field(:username, :string)
    has_many(:clubs, GolfStatsServer.Bag.Club)
    has_many(:rounds, GolfStatsServer.Round)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:username])
    |> validate_required([:username])
    |> unique_constraint(:username)
  end
end
