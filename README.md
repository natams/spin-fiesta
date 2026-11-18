# Spin Fiesta: a free to play roulette demo

I built Spin Fiesta to show how I think about onboarding, daily return and the first purchase in a free to play casino game. It is a small roulette game made with plain HTML, CSS and JavaScript, with no libraries. All coins are play money and nothing real is ever charged or paid.

## How the game works

* A new player sees a welcome popup and claims 5 coins to start.
* A returning player claims 2 coins once per day. Missed days do not stack.
* Every bet costs 1 coin. Players can place up to 6 bets per spin on red, black or any number from 0 to 36.
* Red or black pays 3 coins and a number pays 40.
* Winning several spins in a row builds a streak and earns bonus coins.
* When the coins run out, a popup invites the player to come back tomorrow for 2 coins or buy more. The shop is a demo and takes no payment.
* Coins can be redeemed for demo prizes, which have no cash value.

## Where everything lives

All the content is written directly in `index.html`: headlines, bets, payouts, coin packs, prizes, popups and every message the game shows. If you change a number there, the game follows. The main settings are the `data-` attributes on the `#app` element, which control starter coins, daily coins, bet cost, maximum bets, the size of big and mega wins, and the streak bonus.

## Try it yourself

1. Open `index.html` in a browser.
2. Add `?variant=B` to the address to see the second headline for the A/B test.
3. Open "Demo tools and event log" at the bottom of the page. From there you can skip to tomorrow to test the daily coins, reset the demo as a new player, and watch the tracked events.

## A few details

* The layout works on mobile and desktop.
* Wins come with confetti, a coin rain, a banner that grows with the size of the win, and optional sound.
* Progress is saved in the browser, and the game still works if storage is blocked.
* Double clicks are blocked while the wheel is spinning.
* It respects reduced motion settings and works with a keyboard.
* Tracked events include page_view, variant_assigned, welcome_bonus, daily_bonus, bet_added, spin_start, spin_result, win_big, win_mega, out_of_coins, buy_confirm and redeem_confirm.

## Strategy and next steps

[Write your own notes here: what problem the design solves, what you would test next and what you would measure.]

## Disclaimer

This is a portfolio demo. All coins are play money and prizes have no cash value.
