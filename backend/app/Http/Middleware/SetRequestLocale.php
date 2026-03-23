<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetRequestLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $this->resolveLocale($request);

        app()->setLocale($locale);

        return $next($request);
    }

    protected function resolveLocale(Request $request): string
    {
        $supported = ['en', 'ka'];

        $userLocale = $request->user()?->language;
        if (in_array($userLocale, $supported, true)) {
            return $userLocale;
        }

        $preferred = $request->getPreferredLanguage($supported);
        if (in_array($preferred, $supported, true)) {
            return $preferred;
        }

        return config('app.fallback_locale', 'en');
    }
}
