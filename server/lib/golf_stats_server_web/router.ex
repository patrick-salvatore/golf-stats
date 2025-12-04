defmodule GolfStatsServerWeb.Router do
  use GolfStatsServerWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  scope "/api", GolfStatsServerWeb do
    pipe_through(:api)

    resources("/rounds", RoundController, except: [:new, :edit])
  end
end
