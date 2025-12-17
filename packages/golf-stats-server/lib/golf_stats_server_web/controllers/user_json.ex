defmodule GolfStatsServerWeb.UserJSON do
  alias GolfStatsServer.Accounts.User

  def show(%{user: user}) do
    %{data: data(user)}
  end

  defp data(%User{} = user) do
    %{
      id: user.id,
      username: user.username
    }
  end
end
