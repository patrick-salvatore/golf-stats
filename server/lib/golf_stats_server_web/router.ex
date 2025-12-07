defmodule GolfStatsServerWeb.Router do
  use GolfStatsServerWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  pipeline :auth do
    plug(GolfStatsServerWeb.Plugs.Auth)
  end

  scope "/api", GolfStatsServerWeb do
    pipe_through(:api)

    post("/users", UserController, :create)
  end

  scope "/api", GolfStatsServerWeb do
    pipe_through([:api, :auth])

    resources("/rounds", RoundController, except: [:new, :edit])
    resources("/courses", CourseController, except: [:new, :edit])
    resources("/holes", HoleController, except: [:new, :edit])

    resources("/clubs", ClubController, except: [:new, :edit])
    post("/bag", BagController, :create)
    get("/bag", BagController, :index)

    get("/stats", StatsController, :dashboard)
  end
end
